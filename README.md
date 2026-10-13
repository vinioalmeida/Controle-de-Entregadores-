# Controle de Entregas

## Cadastrar unidades

1. Defina `ADMIN_PASSWORD` em `backend/.env` (a senha inicial compatível com o painel existente é `admin123`; troque-a antes de usar).
2. Entre em `/admin`, informe essa senha e cadastre nome e endereço completo. O backend procura as coordenadas do endereço no OpenStreetMap (Nominatim); confira o endereço encontrado exibido após o cadastro. O raio de validação é fixo em 300 metros.
3. Em “Unidades cadastradas”, abra “Ver QR” para imprimir o QR fixo e exclusivo daquela unidade.

O QR guarda um token aleatório gerado para cada unidade ativa cadastrada no admin. O backend exige localização do aparelho a até 300 metros do endereço. Endereços novos precisam de acesso à internet para geocodificação. A precisão máxima de GPS aceita é 100 metros; ajuste `MAX_LOCATION_ACCURACY_METERS` após testar no local. Registros antigos e suas fotos são mantidos; a antiga unidade “Unidade Principal” deixa de aceitar novos registros.

## Teste local

Abra o frontend em `http://localhost:3000` e permita localização. No Chrome, use DevTools > More tools > Sensors para simular coordenadas dentro e fora do raio da unidade. Para testar a leitura real, mostre a página `/qr` em outra tela ou imprima o código. Em celular, câmera e geolocalização exigem HTTPS; HTTP em endereço IP da rede local não é suficiente.

## Acesso pelo celular na rede Wi-Fi

Conecte computador e celular à mesma rede. Inicie o Flask com `python backend/app.py` e o Next.js com `cd frontend; npm run dev`. No celular, abra `http://10.10.0.104:3000`. Se o IP do computador mudar, atualize `allowedDevOrigins` em `frontend/next.config.mjs` e reinicie o Next.js.

O encaminhamento `/backend` mantém API e imagens no mesmo host do site. Ainda assim, a câmera e a geolocalização do navegador móvel exigem HTTPS; em HTTP pelo IP local, use `http://localhost:3000` para teste no próprio computador ou configure um túnel HTTPS para teste no celular.