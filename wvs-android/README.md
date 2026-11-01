# WVS Corte — Android / Elgin L42 Pro Full

Versão de teste do WVS Corte para um único operador, sem Wi-Fi e sem computador durante a produção. O app usa WebView com arquivos locais, armazenamento do Android WebView e impressão USB OTG experimental.

## APK

Abra **Actions → WVS Corte - Gerar APK Android**, acompanhe a compilação e baixe o artefato `WVS-Corte-Android-USB-teste`, que contém `app-debug.apk`.

## Conexão de impressão

1. Conecte o dispositivo Android com USB OTG à entrada **USB-B quadrada** da Elgin L42 Pro Full. Não use a USB-A retangular.
2. Configure etiqueta 100 × 50 mm e consumíveis na própria impressora.
3. No WVS Corte, abra Configurações e liste dispositivos USB.
4. Escolha o VID/PID da impressora, autorize a permissão Android e envie uma única etiqueta de teste.
5. Confirme no papel dimensão, QR code e alinhamento. A transferência USB concluída não significa necessariamente impressão física concluída.

## Segurança da produção

- Faça backup dos dados do navegador antes de migrar para o APK, pois os armazenamentos são distintos.
- Não use a impressão como operação homologada antes da validação física da L42.
- Os projetos salvos no navegador não são migrados automaticamente.
- O aplicativo lê PDFs no próprio dispositivo para o padrão testado de Valentina; outros layouts precisam de conferência.
- O fluxo e a imagem da etiqueta têm licença de uso da marcenaria, não envie PDFs confidenciais a repositório público.

## Origem do código

O código antigo de outro projeto permanece no repositório. Este app está isolado na pasta `wvs-android/`; apenas o workflow fica em `.github/workflows`.