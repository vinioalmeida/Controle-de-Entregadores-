import os
import math
import secrets
import sqlite3
import json
import re
from contextlib import closing
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'fotos_salvas')
load_dotenv(os.path.join(BASE_DIR, '.env'))
DB_PATH = os.environ.get('DATABASE_PATH', os.path.join(BASE_DIR, 'registros.db'))
UNIT_RADIUS_METERS = 300
MAX_LOCATION_ACCURACY_METERS = float(os.environ.get('MAX_LOCATION_ACCURACY_METERS', '100'))
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

FUSO_BRASILIA = timezone(timedelta(hours=-3))

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row 
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ponto (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entregador_id TEXT NOT NULL,
            tipo_evento TEXT NOT NULL,
            foto_path TEXT NOT NULL,
            data_hora TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS unidades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            endereco TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            raio_metros REAL NOT NULL,
            qr_token TEXT NOT NULL UNIQUE,
            ativa INTEGER NOT NULL DEFAULT 1,
            criada_em TIMESTAMP NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS entregadores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            placa_padrao TEXT,
            telefone TEXT,
            cpf TEXT,
            ativo INTEGER NOT NULL DEFAULT 1,
            criado_em TIMESTAMP NOT NULL
        )
    ''')
    cursor.execute('UPDATE unidades SET raio_metros = 300 WHERE raio_metros != 300')
    existing_columns = {row['name'] for row in cursor.execute('PRAGMA table_info(ponto)')}
    for column, definition in (
        ('unidade_id', 'INTEGER'),
        ('unidade', 'TEXT'),
        ('placa', 'TEXT'),
        ('latitude', 'REAL'),
        ('longitude', 'REAL'),
        ('precisao_metros', 'REAL'),
        ('distancia_metros', 'REAL'),
    ):
        if column not in existing_columns:
            cursor.execute(f'ALTER TABLE ponto ADD COLUMN {column} {definition}')
    conn.commit()
    conn.close()

init_db()


def distancia_metros(latitude_a, longitude_a, latitude_b, longitude_b):
    raio_terra = 6_371_000
    lat_a, lat_b = math.radians(latitude_a), math.radians(latitude_b)
    delta_lat = math.radians(latitude_b - latitude_a)
    delta_lon = math.radians(longitude_b - longitude_a)
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat_a) * math.cos(lat_b) * math.sin(delta_lon / 2) ** 2
    return raio_terra * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def administrador_autenticado():
    senha = request.headers.get('X-Admin-Password', '')
    return bool(ADMIN_PASSWORD) and secrets.compare_digest(senha, ADMIN_PASSWORD)


def buscar_coordenadas_endereco(endereco):
    parametros = urlencode({'format': 'jsonv2', 'limit': 1, 'q': f'{endereco}, Brasil'})
    requisicao = Request(
        f'https://nominatim.openstreetmap.org/search?{parametros}',
        headers={'User-Agent': 'ControleEntregas/1.0 (unit-address-geocoding)'},
    )
    with urlopen(requisicao, timeout=12) as resposta:
        resultados = json.load(resposta)

    if not resultados:
        return None

    resultado = resultados[0]
    latitude = float(resultado['lat'])
    longitude = float(resultado['lon'])
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        return None
    return {
        'latitude': latitude,
        'longitude': longitude,
        'endereco_encontrado': resultado.get('display_name', endereco),
    }


def unidade_publica(row):
    return {
        'id': row['id'],
        'nome': row['nome'],
        'endereco': row['endereco'],
        'latitude': row['latitude'],
        'longitude': row['longitude'],
        'raio_metros': row['raio_metros'],
        'ativa': bool(row['ativa']),
        'criada_em': row['criada_em'],
    }


def entregador_publico(row):
    return {
        'id': row['id'],
        'nome': row['nome'],
        'placa_padrao': row['placa_padrao'] or '',
        'telefone': row['telefone'] or '',
        'cpf': row['cpf'] or '',
        'ativo': bool(row['ativo']),
        'criado_em': row['criado_em'],
    }


@app.route('/admin/autenticar', methods=['POST'])
def autenticar_administrador():
    dados = request.get_json(silent=True) or {}
    senha = str(dados.get('senha', ''))
    if ADMIN_PASSWORD and secrets.compare_digest(senha, ADMIN_PASSWORD):
        return jsonify({'autenticado': True})
    return jsonify({'erro': 'Senha incorreta.'}), 401


# ==========================================
# ROTAS DE UNIDADES
# ==========================================
@app.route('/admin/unidades', methods=['GET', 'POST'])
def gerenciar_unidades():
    if not administrador_autenticado():
        return jsonify({'erro': 'Acesso não autorizado.'}), 401

    if request.method == 'GET':
        with closing(get_db_connection()) as conn:
            unidades = conn.execute(
                'SELECT * FROM unidades ORDER BY nome COLLATE NOCASE'
            ).fetchall()
        return jsonify([unidade_publica(unidade) for unidade in unidades])

    dados = request.get_json(silent=True) or {}
    nome = str(dados.get('nome', '')).strip()
    endereco = str(dados.get('endereco', '')).strip()
    if not nome or not endereco:
        return jsonify({'erro': 'Nome e endereço são obrigatórios.'}), 400

    try:
        coordenadas = buscar_coordenadas_endereco(endereco)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
        app.logger.warning('Falha ao localizar endereço da unidade: %s', error)
        return jsonify({'erro': 'Não foi possível consultar o endereço. Verifique a conexão e tente novamente.'}), 502
    if not coordenadas:
        return jsonify({'erro': 'Endereço não encontrado. Informe rua, número, cidade e estado.'}), 422

    token = secrets.token_urlsafe(32)
    criada_em = datetime.now(FUSO_BRASILIA).strftime('%Y-%m-%d %H:%M:%S')
    with closing(get_db_connection()) as conn:
        cursor = conn.execute('''
            INSERT INTO unidades (nome, endereco, latitude, longitude, raio_metros, qr_token, criada_em)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            nome,
            endereco,
            coordenadas['latitude'],
            coordenadas['longitude'],
            UNIT_RADIUS_METERS,
            token,
            criada_em,
        ))
        conn.commit()
        unidade_id = cursor.lastrowid
        unidade = conn.execute('SELECT * FROM unidades WHERE id = ?', (unidade_id,)).fetchone()

    resultado = unidade_publica(unidade)
    resultado['endereco_encontrado'] = coordenadas['endereco_encontrado']
    return jsonify(resultado), 201


@app.route('/admin/unidades/<int:unidade_id>/qr', methods=['GET'])
def obter_qr_unidade(unidade_id):
    if not administrador_autenticado():
        return jsonify({'erro': 'Acesso não autorizado.'}), 401
    with closing(get_db_connection()) as conn:
        unidade = conn.execute(
            'SELECT id, nome, endereco, qr_token FROM unidades WHERE id = ? AND ativa = 1',
            (unidade_id,),
        ).fetchone()
    if not unidade:
        return jsonify({'erro': 'Unidade não encontrada.'}), 404
    return jsonify(dict(unidade))


@app.route('/admin/unidades/<int:unidade_id>', methods=['PUT', 'DELETE'])
def atualizar_excluir_unidade(unidade_id):
    if not administrador_autenticado():
        return jsonify({'erro': 'Acesso não autorizado.'}), 401

    with closing(get_db_connection()) as conn:
        existente = conn.execute('SELECT * FROM unidades WHERE id = ?', (unidade_id,)).fetchone()
        if not existente:
            return jsonify({'erro': 'Unidade não encontrada.'}), 404

        if request.method == 'DELETE':
            conn.execute('UPDATE unidades SET ativa = 0 WHERE id = ?', (unidade_id,))
            conn.commit()
            return jsonify({'mensagem': 'Unidade desativada.', 'ativa': False})

        dados = request.get_json(silent=True) or {}
        nome = str(dados.get('nome', '')).strip()
        endereco = str(dados.get('endereco', '')).strip()
        if not nome or not endereco:
            return jsonify({'erro': 'Nome e endereço são obrigatórios.'}), 400

        try:
            coordenadas = buscar_coordenadas_endereco(endereco)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
            app.logger.warning('Falha ao atualizar endereço da unidade: %s', error)
            return jsonify({'erro': 'Não foi possível consultar o endereço. Verifique a conexão e tente novamente.'}), 502
        if not coordenadas:
            return jsonify({'erro': 'Endereço não encontrado. Informe rua, número, cidade e estado.'}), 422

        conn.execute('''
            UPDATE unidades
            SET nome = ?, endereco = ?, latitude = ?, longitude = ?, raio_metros = ?
            WHERE id = ?
        ''', (nome, endereco, coordenadas['latitude'], coordenadas['longitude'], UNIT_RADIUS_METERS, unidade_id))
        conn.commit()
        unidade = conn.execute('SELECT * FROM unidades WHERE id = ?', (unidade_id,)).fetchone()

    resultado = unidade_publica(unidade)
    resultado['endereco_encontrado'] = coordenadas['endereco_encontrado']
    return jsonify(resultado)


@app.route('/admin/unidades/<int:unidade_id>/ativar', methods=['POST'])
def ativar_unidade(unidade_id):
    if not administrador_autenticado():
        return jsonify({'erro': 'Acesso não autorizado.'}), 401
    with closing(get_db_connection()) as conn:
        cursor = conn.execute('UPDATE unidades SET ativa = 1 WHERE id = ?', (unidade_id,))
        conn.commit()
    if cursor.rowcount == 0:
        return jsonify({'erro': 'Unidade não encontrada.'}), 404
    return jsonify({'mensagem': 'Unidade reativada.', 'ativa': True})


# ==========================================
# ROTAS DE ENTREGADORES
# ==========================================
@app.route('/entregadores', methods=['GET'])
def listar_entregadores_publico():
    with closing(get_db_connection()) as conn:
        entregadores = conn.execute(
            'SELECT * FROM entregadores WHERE ativo = 1 ORDER BY nome COLLATE NOCASE'
        ).fetchall()
    return jsonify([entregador_publico(e) for e in entregadores])


@app.route('/admin/entregadores', methods=['GET', 'POST'])
def gerenciar_entregadores():
    if not administrador_autenticado():
        return jsonify({'erro': 'Acesso não autorizado.'}), 401

    if request.method == 'GET':
        with closing(get_db_connection()) as conn:
            entregadores = conn.execute(
                'SELECT * FROM entregadores ORDER BY nome COLLATE NOCASE'
            ).fetchall()
        return jsonify([entregador_publico(e) for e in entregadores])

    dados = request.get_json(silent=True) or {}
    nome = str(dados.get('nome', '')).strip()
    placa_padrao = re.sub(r'[^A-Za-z0-9]', '', str(dados.get('placa_padrao', ''))).upper()
    telefone = str(dados.get('telefone', '')).strip()
    cpf = str(dados.get('cpf', '')).strip()

    if not nome:
        return jsonify({'erro': 'O nome do entregador é obrigatório.'}), 400
    if placa_padrao and not re.fullmatch(r'[A-Z0-9]{7}', placa_padrao):
        return jsonify({'erro': 'A placa deve conter 7 caracteres alfanuméricos.'}), 400

    criado_em = datetime.now(FUSO_BRASILIA).strftime('%Y-%m-%d %H:%M:%S')
    with closing(get_db_connection()) as conn:
        cursor = conn.execute('''
            INSERT INTO entregadores (nome, placa_padrao, telefone, cpf, ativo, criado_em)
            VALUES (?, ?, ?, ?, 1, ?)
        ''', (nome, placa_padrao, telefone, cpf, criado_em))
        conn.commit()
        entregador_id = cursor.lastrowid
        entregador = conn.execute('SELECT * FROM entregadores WHERE id = ?', (entregador_id,)).fetchone()

    return jsonify(entregador_publico(entregador)), 201


@app.route('/admin/entregadores/<int:entregador_id>', methods=['PUT', 'DELETE'])
def atualizar_excluir_entregador(entregador_id):
    if not administrador_autenticado():
        return jsonify({'erro': 'Acesso não autorizado.'}), 401

    with closing(get_db_connection()) as conn:
        existente = conn.execute('SELECT * FROM entregadores WHERE id = ?', (entregador_id,)).fetchone()
        if not existente:
            return jsonify({'erro': 'Entregador não encontrado.'}), 404

        if request.method == 'DELETE':
            conn.execute('UPDATE entregadores SET ativo = 0 WHERE id = ?', (entregador_id,))
            conn.commit()
            return jsonify({'mensagem': 'Entregador desativado.', 'ativo': False})

        dados = request.get_json(silent=True) or {}
        nome = str(dados.get('nome', '')).strip()
        placa_padrao = re.sub(r'[^A-Za-z0-9]', '', str(dados.get('placa_padrao', ''))).upper()
        telefone = str(dados.get('telefone', '')).strip()
        cpf = str(dados.get('cpf', '')).strip()

        if not nome:
            return jsonify({'erro': 'O nome do entregador é obrigatório.'}), 400
        if placa_padrao and not re.fullmatch(r'[A-Z0-9]{7}', placa_padrao):
            return jsonify({'erro': 'A placa deve conter 7 caracteres alfanuméricos.'}), 400

        conn.execute('''
            UPDATE entregadores
            SET nome = ?, placa_padrao = ?, telefone = ?, cpf = ?
            WHERE id = ?
        ''', (nome, placa_padrao, telefone, cpf, entregador_id))
        conn.commit()
        entregador = conn.execute('SELECT * FROM entregadores WHERE id = ?', (entregador_id,)).fetchone()

    return jsonify(entregador_publico(entregador))


@app.route('/admin/entregadores/<int:entregador_id>/ativar', methods=['POST'])
def ativar_entregador(entregador_id):
    if not administrador_autenticado():
        return jsonify({'erro': 'Acesso não autorizado.'}), 401
    with closing(get_db_connection()) as conn:
        cursor = conn.execute('UPDATE entregadores SET ativo = 1 WHERE id = ?', (entregador_id,))
        conn.commit()
    if cursor.rowcount == 0:
        return jsonify({'erro': 'Entregador não encontrado.'}), 404
    return jsonify({'mensagem': 'Entregador reativado.', 'ativo': True})


# ==========================================
# REGISTRO DE PONTO E CONSULTAS
# ==========================================
@app.route('/registrar', methods=['POST'])
def registrar_ponto():
    dados = request.get_json(silent=True) or {}
    entregador_id = str(dados.get('entregador_id', '')).strip()
    placa = re.sub(r'[^A-Za-z0-9]', '', str(dados.get('placa', ''))).upper()
    tipo_evento = dados.get('tipo_evento')
    qr_token = str(dados.get('qr_token', '')).strip()

    if not entregador_id or tipo_evento not in ('chegada', 'saida'):
        return jsonify({"erro": "Informe o entregador e selecione chegada ou saída."}), 400
    with closing(get_db_connection()) as conn:
        entregador = conn.execute(
            'SELECT nome FROM entregadores WHERE nome = ? COLLATE NOCASE AND ativo = 1',
            (entregador_id,),
        ).fetchone()
    if not entregador:
        return jsonify({"erro": "Selecione um entregador ativo cadastrado."}), 400
    entregador_id = entregador['nome']

    if not re.fullmatch(r'[A-Z0-9]{7}', placa):
        return jsonify({"erro": "Informe uma placa válida com 7 letras e números."}), 400
    with closing(get_db_connection()) as conn:
        row = conn.execute(
            'SELECT id, nome, latitude, longitude, raio_metros FROM unidades WHERE qr_token = ? AND ativa = 1',
            (qr_token,),
        ).fetchone() if qr_token else None

    if row:
        unidade = {
            'id': row['id'],
            'nome': row['nome'],
            'latitude': row['latitude'],
            'longitude': row['longitude'],
            'raio_metros': row['raio_metros'],
        }
    else:
        return jsonify({"erro": "QR Code inválido. Escaneie o código fixado na unidade."}), 400

    try:
        latitude = float(dados['latitude'])
        longitude = float(dados['longitude'])
        precisao = float(dados['precisao_metros'])
    except (KeyError, TypeError, ValueError):
        return jsonify({"erro": "A localização do aparelho é obrigatória."}), 400

    if (not math.isfinite(latitude) or not math.isfinite(longitude) or not math.isfinite(precisao)
            or not -90 <= latitude <= 90 or not -180 <= longitude <= 180 or precisao < 0):
        return jsonify({"erro": "A localização recebida é inválida."}), 400
    if precisao > MAX_LOCATION_ACCURACY_METERS:
        return jsonify({"erro": f"Localização imprecisa (±{precisao:.0f} m). Ative o GPS e tente novamente."}), 400

    distancia = distancia_metros(latitude, longitude, unidade['latitude'], unidade['longitude'])
    if distancia > unidade['raio_metros']:
        return jsonify({"erro": f"Você está fora da área da unidade ({distancia:.0f} m; limite {unidade['raio_metros']:.0f} m)."}), 403

    conn = get_db_connection()
    conn.execute('BEGIN IMMEDIATE')
    ultimo_evento = conn.execute(
        '''SELECT tipo_evento FROM ponto
           WHERE lower(trim(entregador_id)) = lower(trim(?))
           ORDER BY data_hora DESC, id DESC LIMIT 1''',
        (entregador_id,),
    ).fetchone()
    evento_esperado = 'saida' if ultimo_evento and ultimo_evento['tipo_evento'] == 'chegada' else 'chegada'
    if tipo_evento != evento_esperado:
        conn.rollback()
        conn.close()
        proxima_acao = 'saída' if evento_esperado == 'saida' else 'chegada'
        return jsonify({"erro": f"Registro não permitido. Para este entregador, a próxima ação deve ser {proxima_acao}. Atualize a tela e tente novamente."}), 409

    timestamp_db = datetime.now(FUSO_BRASILIA).strftime("%Y-%m-%d %H:%M:%S")
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO ponto (
            entregador_id, tipo_evento, foto_path, data_hora, unidade_id, unidade, placa,
            latitude, longitude, precisao_metros, distancia_metros
        ) VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        entregador_id,
        tipo_evento,
        timestamp_db,
        unidade['id'],
        unidade['nome'],
        placa,
        latitude,
        longitude,
        precisao,
        distancia,
    ))
    conn.commit()
    conn.close()

    return jsonify({"mensagem": f"{tipo_evento.capitalize()} registrada em {unidade['nome']}.", "distancia_metros": round(distancia)}), 200

@app.route('/registros', methods=['GET'])
def listar_registros():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ponto ORDER BY data_hora DESC") 
    registros = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(registros)


@app.route('/uploads/<path:filename>')
def serve_foto(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
