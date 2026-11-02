# WVS Teste USB (diagnóstico separado)

Aplicativo independente para diagnosticar o transporte USB e o reconhecimento de comandos ZPL/EPL na Elgin L42 Pro Full.

- Não abre nem modifica clientes/projetos do WVS Corte.
- Selecione a impressora `VID 8401 PID 1792` (o adaptador Ethernet do hub é diferente).
- Teste primeiro FEED e autoteste físico conforme manual da Elgin.
- Teste ZPL com texto simples; caso não avance papel, teste EPL (somente uma vez).
- `X bytes aceitos` confirma apenas comunicação USB, NÃO impressão nem calibração.
- O modelo usa porta USB-B quadrada da impressora, com USB OTG no Android.
- Para testar sem cabo USB ou sem impressora o aplicativo não terá função útil.

Código fonte de diagnóstico, sem conexão à internet. APK via GitHub Actions, workflow wvs-usb-diagnostico-apk.yml.