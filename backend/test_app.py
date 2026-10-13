import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from unittest.mock import patch

TEST_DIRECTORY = tempfile.TemporaryDirectory()
os.environ['DATABASE_PATH'] = os.path.join(TEST_DIRECTORY.name, 'test.db')
os.environ['MAX_LOCATION_ACCURACY_METERS'] = '100'

import app as backend


class RegistroTests(unittest.TestCase):
    def setUp(self):
        with closing(backend.get_db_connection()) as conn:
            conn.execute('DELETE FROM ponto')
            conn.execute('DELETE FROM unidades')
            conn.execute('DELETE FROM entregadores')
            conn.commit()
        self.client = backend.app.test_client()
        self.payload = {
            'entregador_id': 'Entregador Teste',
            'placa': 'abc1d23',
            'tipo_evento': 'chegada',
            'qr_token': 'test-registered-qr',
            'latitude': 0,
            'longitude': 0.0001,
            'precisao_metros': 15,
        }

    def cadastrar_unidade_teste(self):
        with closing(backend.get_db_connection()) as conn:
            conn.execute('''
                INSERT INTO unidades (
                    nome, endereco, latitude, longitude, raio_metros, qr_token, criada_em
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                'Unidade de Teste',
                'Rua de Teste, 1, Guarulhos, SP',
                0,
                0,
                300,
                'test-registered-qr',
                '2026-01-01 10:00:00',
            ))
            conn.commit()

    def test_registra_qr_e_localizacao_validos(self):
        self.cadastrar_unidade_teste()
        response = self.client.post('/registrar', json=self.payload)
        self.assertEqual(response.status_code, 200)

        response = self.client.get('/registros')
        registro = response.get_json()[0]
        self.assertEqual(registro['unidade'], 'Unidade de Teste')
        self.assertEqual(registro['placa'], 'ABC1D23')
        self.assertEqual(registro['foto_path'], '')
        self.assertAlmostEqual(registro['distancia_metros'], 11.12, delta=1)

    def test_rejeita_token_invalido(self):
        response = self.client.post('/registrar', json={**self.payload, 'qr_token': 'outro-token'})
        self.assertEqual(response.status_code, 400)

    def test_rejeita_localizacao_fora_do_raio(self):
        self.cadastrar_unidade_teste()
        response = self.client.post('/registrar', json={**self.payload, 'longitude': 0.01})
        self.assertEqual(response.status_code, 403)

    def test_rejeita_localizacao_imprecisa(self):
        self.cadastrar_unidade_teste()
        response = self.client.post('/registrar', json={**self.payload, 'precisao_metros': 101})
        self.assertEqual(response.status_code, 400)

    def test_exige_localizacao(self):
        self.cadastrar_unidade_teste()
        dados = {key: value for key, value in self.payload.items() if key != 'latitude'}
        response = self.client.post('/registrar', json=dados)
        self.assertEqual(response.status_code, 400)

    def test_rejeita_placa_invalida(self):
        response = self.client.post('/registrar', json={**self.payload, 'placa': 'ABC123'})
        self.assertEqual(response.status_code, 400)

    def test_admin_exige_autenticacao_para_listar_unidades(self):
        response = self.client.get('/admin/unidades')
        self.assertEqual(response.status_code, 401)

    def test_cadastra_unidade_com_endereco_e_qr_individual(self):
        coordenadas = {
            'latitude': -23.422096,
            'longitude': -46.404179,
            'endereco_encontrado': 'Rua de Teste, Guarulhos, SP',
        }
        cabecalhos = {'X-Admin-Password': backend.ADMIN_PASSWORD}
        with patch.object(backend, 'buscar_coordenadas_endereco', return_value=coordenadas) as geocodificar:
            response = self.client.post('/admin/unidades', headers=cabecalhos, json={
                'nome': 'Unidade Norte',
                'endereco': 'Rua de Teste, 123, Guarulhos, SP',
                'raio_metros': 9500,
            })

        self.assertEqual(response.status_code, 201)
        unidade = response.get_json()
        self.assertEqual(unidade['latitude'], coordenadas['latitude'])
        self.assertEqual(unidade['raio_metros'], 300)
        self.assertEqual(unidade['endereco_encontrado'], coordenadas['endereco_encontrado'])
        geocodificar.assert_called_once_with('Rua de Teste, 123, Guarulhos, SP')

        response = self.client.get('/admin/unidades', headers=cabecalhos)
        unidades = response.get_json()
        self.assertEqual(len(unidades), 1)
        self.assertNotIn('qr_token', unidades[0])

        response = self.client.get(f"/admin/unidades/{unidade['id']}/qr", headers=cabecalhos)
        qr = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(qr['qr_token'])

        payload = {
            **self.payload,
            'qr_token': qr['qr_token'],
            'latitude': coordenadas['latitude'],
            'longitude': coordenadas['longitude'],
        }
        response = self.client.post('/registrar', json=payload)
        self.assertEqual(response.status_code, 200)
        registro = self.client.get('/registros').get_json()[0]
        self.assertEqual(registro['unidade_id'], unidade['id'])
        self.assertEqual(registro['unidade'], 'Unidade Norte')

        novas_coordenadas = {
            'latitude': -23.5,
            'longitude': -46.5,
            'endereco_encontrado': 'Avenida Atualizada, Guarulhos, SP',
        }
        with patch.object(backend, 'buscar_coordenadas_endereco', return_value=novas_coordenadas):
            response = self.client.put(f"/admin/unidades/{unidade['id']}", headers=cabecalhos, json={
                'nome': 'Unidade Norte Atualizada',
                'endereco': 'Avenida Atualizada, 456, Guarulhos, SP',
                'raio_metros': 250,
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['latitude'], novas_coordenadas['latitude'])
        self.assertEqual(response.get_json()['raio_metros'], 300)

        response = self.client.delete(f"/admin/unidades/{unidade['id']}", headers=cabecalhos)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['ativa'], False)
        self.assertEqual(self.client.get(f"/admin/unidades/{unidade['id']}/qr", headers=cabecalhos).status_code, 404)
        self.assertEqual(self.client.post('/registrar', json=payload).status_code, 400)

        response = self.client.post(f"/admin/unidades/{unidade['id']}/ativar", headers=cabecalhos)
        self.assertEqual(response.status_code, 200)
        unidades = self.client.get('/admin/unidades', headers=cabecalhos).get_json()
        self.assertTrue(unidades[0]['ativa'])
        self.assertEqual(len(self.client.get('/registros').get_json()), 1)

    def test_gerenciamento_entregadores(self):
        cabecalhos = {'X-Admin-Password': backend.ADMIN_PASSWORD}

        # Cadastra entregador
        response = self.client.post('/admin/entregadores', headers=cabecalhos, json={
            'nome': 'Carlos Silva',
            'placa_padrao': 'ABC1D23',
            'telefone': '11999998888',
        })
        self.assertEqual(response.status_code, 201)
        entregador = response.get_json()
        self.assertEqual(entregador['nome'], 'Carlos Silva')
        self.assertEqual(entregador['placa_padrao'], 'ABC1D23')
        self.assertTrue(entregador['ativo'])

        # Lista entregadores admin
        response = self.client.get('/admin/entregadores', headers=cabecalhos)
        self.assertEqual(len(response.get_json()), 1)

        # Lista entregadores publico
        response = self.client.get('/entregadores')
        self.assertEqual(len(response.get_json()), 1)

        # Atualiza entregador
        response = self.client.put(f"/admin/entregadores/{entregador['id']}", headers=cabecalhos, json={
            'nome': 'Carlos Silva Santos',
            'placa_padrao': 'XYZ9W88',
            'telefone': '11999997777',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['nome'], 'Carlos Silva Santos')
        self.assertEqual(response.get_json()['placa_padrao'], 'XYZ9W88')

        # Desativa entregador
        response = self.client.delete(f"/admin/entregadores/{entregador['id']}", headers=cabecalhos)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.get_json()['ativo'])

        # Nao aparece na lista publica quando inativo
        self.assertEqual(len(self.client.get('/entregadores').get_json()), 0)

        # Reativa entregador
        response = self.client.post(f"/admin/entregadores/{entregador['id']}/ativar", headers=cabecalhos)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['ativo'])
        self.assertEqual(len(self.client.get('/entregadores').get_json()), 1)

    def test_autenticacao_admin_valida_senha_no_backend(self):
        response = self.client.post('/admin/autenticar', json={'senha': 'errada'})
        self.assertEqual(response.status_code, 401)
        response = self.client.post('/admin/autenticar', json={'senha': backend.ADMIN_PASSWORD})
        self.assertEqual(response.status_code, 200)

    def test_migracao_preserva_registro_com_foto(self):
        caminho_anterior = backend.DB_PATH
        banco_legado = os.path.join(TEST_DIRECTORY.name, 'legacy.db')
        with closing(sqlite3.connect(banco_legado)) as conn:
            conn.execute('''
                CREATE TABLE ponto (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entregador_id TEXT NOT NULL,
                    tipo_evento TEXT NOT NULL,
                    foto_path TEXT NOT NULL,
                    data_hora TIMESTAMP
                )
            ''')
            conn.execute(
                'INSERT INTO ponto (entregador_id, tipo_evento, foto_path, data_hora) VALUES (?, ?, ?, ?)',
                ('Antigo', 'chegada', 'foto-antiga.jpg', '2026-01-01 10:00:00'),
            )
            conn.commit()

        try:
            backend.DB_PATH = banco_legado
            backend.init_db()
            with closing(backend.get_db_connection()) as conn:
                registro = conn.execute('SELECT * FROM ponto').fetchone()
                colunas = {row['name'] for row in conn.execute('PRAGMA table_info(ponto)')}
            self.assertEqual(registro['foto_path'], 'foto-antiga.jpg')
            self.assertIn('latitude', colunas)
            self.assertIn('distancia_metros', colunas)
            self.assertIn('placa', colunas)
        finally:
            backend.DB_PATH = caminho_anterior


if __name__ == '__main__':
    unittest.main()
