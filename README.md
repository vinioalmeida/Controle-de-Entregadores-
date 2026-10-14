# Controle de Entregas

## Cadastrar unidades

1. Defina `ADMIN_PASSWORD` em `backend/.env` (a senha inicial compatível com o painel existente é `admin123`; troque-a antes de usar).
2. Entre em `/admin`, informe essa senha e cadastre nome e endereço completo. O backend procura as coordenadas do endereço no OpenStreetMap (Nominatim); confira o endereço encontrado exibido após o cadastro. O raio de validação é fixo em 300 metros.
3. Em “Unidades cadastradas”, abra “Ver QR” para imprimir o QR fixo e exclusivo daquela unidade.

O QR guarda um token aleatório gerado para cada unidade ativa cadastrada no admin. O backend exige localização do aparelho a até 300 metros do endereço. Endereços novos precisam de acesso à internet para geocodificação. A precisão máxima de GPS aceita é 100 metros; ajuste `MAX_LOCATION_ACCURACY_METERS` após testar no local. Registros antigos e suas fotos são mantidos; a antiga unidade “Unidade Principal” deixa de aceitar novos registros.

## Teste local

Abra o frontend em `http://localhost:3000` e permita localização. No Chrome, use DevTools > More tools > Sensors para simular coordenadas dentro e fora do raio da unidade. Para testar a leitura real, mostre a página `/qr` em outra tela ou imprima o código. Em celular, câmera e geolocalização exigem HTTPS; HTTP em endereço IP da rede local não é suficiente.
