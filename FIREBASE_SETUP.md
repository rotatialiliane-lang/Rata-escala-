# Rota Escolar — configuração Firebase

Esta versão já possui:
- cadastro de crianças;
- cadastro de motoristas;
- alterações do dia;
- cálculo básico do horário de saída;
- tela do motorista;
- GPS pelo navegador;
- mapa ao vivo com OpenStreetMap;
- abertura da rota no Google Maps;
- sincronização entre aparelhos via Firebase Realtime Database.

## Para ativar a sincronização

1. Crie um projeto no Firebase.
2. Ative Authentication > Sign-in method > Anonymous.
3. Crie um Realtime Database.
4. Copie o conteúdo de `firebase-rules.json` para a aba Rules do Realtime Database e publique.
5. Em Project settings > Your apps, crie um app Web e copie:
   - apiKey
   - authDomain
   - databaseURL
   - projectId
   - appId
6. Abra o Rota Escolar > Configurações > Configurar Firebase / Google Maps.
7. Cole os dados e salve.
8. Em outro aparelho, use "Copiar configuração para outro aparelho".

## Segurança do MVP
O banco bloqueia leitura e escrita sem autenticação. Cada empresa usa um namespace derivado de um código privado forte. Não compartilhe esse código publicamente.
