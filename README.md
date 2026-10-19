# JB App — Capacitor

Aplicativo Android/iOS com frontend empacotado e demo local. Não usa Expo,
React Native, servidor Next.js ou `server.url` para abrir as telas.

## Preparar e executar

Requisitos: Node.js 22.12+ (ou versão suportada pelo Vite 8), npm e os diretórios
`jb-app` e `jb-web-frontend` lado a lado. As telas são importadas do frontend;
não copie nem mantenha uma segunda versão delas no app.

```powershell
cd H:\JB\jb-app
npm ci
npm run dev
```

Abra a URL mostrada pelo Vite. Clique em **Entrar na demonstração**.
No navegador, a persistência usa IndexedDB; no Android/iOS instalado, usa SQLite.
O servidor Vite serve somente para desenvolvimento/prévia e não é necessário
no aplicativo compilado.

## Gerar o pacote web e sincronizar os projetos nativos

```powershell
npm run sync
```

Esse comando verifica TypeScript, gera `dist` e copia os arquivos para Android/iOS.
Os diretórios `android` e `ios` já estão gerados. Não execute `cap add` novamente.

### Android

Instale/configure Android Studio, Android SDK 36 e JDK 21. Verifique que
`JAVA_HOME` aponta para o JDK 21 e que `ANDROID_HOME` aponta para o SDK (ou configure
`sdk.dir` em `android/local.properties`). O Java no PATH e o `JAVA_HOME` podem diferir.

```powershell
npm run sync
npm run android
```

No Android Studio, gere o APK de debug ou execute em aparelho/emulador. Pelo terminal:

```powershell
cd android
.\gradlew.bat assembleDebug
```

Saída esperada: `android/app/build/outputs/apk/debug/app-debug.apk`.
O APK debug serve para demonstração; distribuição em loja exige assinatura de release.

### iOS

Em um Mac com Xcode e ferramentas de desenvolvimento configuradas, mantenha os dois
diretórios lado a lado, execute `npm ci`, `npm run sync` e `npm run ios`.
Selecione a equipe de assinatura no Xcode antes de instalar em um iPhone.
O projeto usa Swift Package Manager. Compilação/assinatura iOS não é feita no Windows.

## Reutilização do frontend

- `vite.config.ts`: importa páginas, componentes, estilos e `public` diretamente de
  `../jb-web-frontend`. Não altera o modo de build do site.
- `src/compat`: implementa somente os recursos de Link, Head, dynamic e router usados
  hoje pelas telas. Novos recursos do Next precisam ser avaliados antes de reutilizar.
- `src/main.tsx`: usa rotas hash e executa os carregadores existentes no cliente,
  redirecionando `requestBackend` para o adaptador local. Não executa SSR nem API Routes.
- `src/data/api.ts`: atende as chamadas relativas `/api/*` localmente. Não envia
  dados da demo ao backend. Uma rota sem suporte retorna um erro explícito.
- `src/data/storage.ts`: SQLite em Android/iOS, IndexedDB apenas na prévia web.
- A única adaptação compartilhada nas telas permite uma URL local nos metadados
  de fotos de progresso; o endereço original da API continua como fallback no site.

O aplicativo funciona em runtime sem o código-fonte web, pois ele é incluído no build.
Para desenvolver/compilar, o diretório irmão é obrigatório. Mudanças no frontend
exigem novo build e sincronização para chegar ao app instalado.

## Escopo da demo

- Entrada local identificada como demonstração, sem conta real.
- Obra, tarefa e despesa fictícias iniciais, criadas uma única vez.
- Obras, tarefas, despesas, receitas e grupos locais; relatórios e calendário
  consomem os mesmos dados.
- Anexos de imagem/PDF locais, com limite aproximado de 6 MB por arquivo.
- Endereço digitado manualmente e lista de localizações em lugar de mapa online.
- Sair da demo retorna à entrada e mantém os dados.
- Contas, membros, convites, links públicos e sincronização entre aparelhos
  não estão implementados; as operações retornam mensagem de indisponibilidade.

O SQLite desta primeira demo guarda o estado JSON versionado em uma tabela
`app_state`, com gravações serializadas. É uma implementação pequena para dados de
demonstração, não um esquema relacional final nem um sistema de sincronização.
Anexos também ficam no estado; grandes volumes exigirão arquivos separados e migração.
Não existe autenticação, criptografia de banco ou backup/exportação implementados.
Desinstalar/limpar dados pode apagar o conteúdo local. Use dados fictícios.

Identificador inicial: `com.jbmanagement.app`. Nome: `JB Management`.
Ícones e splash nativos ainda usam os assets padrão do Capacitor; o logo JB das telas
vem do frontend. Revise identificador, ícones, splash e assinatura antes da distribuição.

## Verificações

```powershell
npm test
npm run check:screens
npm run build
```

- Testes de dados: persistência/reabertura, gravações simultâneas, falha de gravação,
  integridade de referências, exclusão, anexos e banco incompatível.
- `check:screens`: carrega e renderiza as nove telas compartilhadas usando os dados
  locais; verifica a fronteira de compatibilidade, não substitui teste em dispositivo.
- Build TypeScript/Vite e sincronização Capacitor.

A compilação nativa e o SQLite real precisam de validação em aparelho/emulador.
Nesta preparação, os projetos foram gerados/sincronizados, mas nenhum APK/IPA foi
compilado e não houve teste em dispositivo. Não foi localizado Android SDK no ambiente.

Para validar no aparelho: instalar, abrir a demo, ativar modo avião, cadastrar uma obra
com endereço manual, criar/mover tarefa, registrar despesa, anexar foto, fechar/reabrir
e confirmar persistência. Conferir também voltar do Android, teclado e áreas seguras.
