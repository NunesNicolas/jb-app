# JB App — standalone local

Aplicativo Android/iOS com Capacitor, funcional sem cadastro, login, nuvem ou API
remota. Abre diretamente nas obras. A primeira instalação começa com banco vazio;
os registros criados pelo usuário são persistentes e reais.

## Desenvolvimento

Requisitos: Node.js 22.12+ compatível com Vite 8, npm e os diretórios `jb-app` e
`jb-web-frontend` lado a lado. As telas, componentes, estilos e assets vêm do
frontend original, sem cópias para manter separadamente.

```powershell
cd H:\JB\jb-app
npm ci
npm run dev
```

Abra a URL indicada pelo Vite. A prévia usa IndexedDB. No aplicativo instalado,
os dados ficam no SQLite. O servidor Vite só é necessário para desenvolvimento.

## Funcionalidades locais

- Cadastro, edição e exclusão de obras; orçamento, situação e capa.
- Tarefas, responsáveis informativos, prazos, prioridades e movimentação de status.
- Despesas e receitas, totais, relatórios e calendário baseados nos registros locais.
- Empresas para organizar obras, sem contas, membros online ou permissões remotas.
- Fotos de progresso e anexos PNG/JPEG/WebP/GIF/PDF (até aproximadamente 6 MB por anexo).
- Importação/exportação CSV de despesas.
- Endereços digitados manualmente e listagem de localizações, sem geocodificação ou
  tiles de mapa externos.
- Exportação e restauração de backup completo, incluindo anexos, em **Dados e backup**.

O acesso ao backup está no painel de obras e na navegação lateral. A importação
valida o arquivo e mostra as quantidades antes da confirmação de substituição.
Arquivos de backup aceitos têm até 100 MB. A exportação de arquivos no celular usa
o seletor do sistema; o usuário escolhe onde salvar. Não há envio automático.
Guarde o backup fora da área interna do app, especialmente antes de desinstalar.

## Arquitetura

- `vite.config.ts`: aliases para reutilizar as telas Next/React como aplicação local.
- `src/compat`: implementa os recursos de Link, Head, dynamic e router usados hoje.
- `src/main.tsx`: rotas hash e carregamento local dos dados das páginas. Não roda
  servidor Next nem rotas HTTP de backend no celular.
- `src/data/local-fetch.ts`: as chamadas `/api/*` que já existem nas telas são
  interceptadas dentro do processo e atendidas pelo banco local, sem requisição HTTP.
  Destinos externos são bloqueados. A política de conteúdo do build também restringe
  conexões e recursos à origem local.
- `src/data/store.ts`: regras de validação, CRUD, referências, histórico, migração
  versionada e backup. Não existem usuário remoto, senha ou token de autenticação;
  uma identidade interna do aparelho mantém os contratos de dados do frontend.
- `src/data/sqlite-storage.ts`: snapshots JSON em blocos pequenos no SQLite,
  substituídos em uma transação. Isso evita linhas grandes com fotos no Android.
  A memória só é atualizada depois da persistência bem-sucedida.
- `src/save-file.ts`: exportação nativa por Filesystem/Share, sem backend.
- `@/lib/runtime`: mantém a versão web com contas e recursos online; o app substitui
  essa configuração para mostrar somente os fluxos locais.

Os nomes internos históricos `jb_demo`/`jb-demo` foram mantidos exclusivamente
para preservar bancos já existentes. A migração v1 → v2 não apaga registros,
inclusive exemplos antigos que possam ter sido editados. Instalações novas não
recebem exemplos; registros antigos podem ser removidos pelos controles normais.

O estado ainda é carregado em memória, incluindo anexos. Grandes acervos exigirão
armazenamento separado de arquivos e consultas paginadas. O banco não tem criptografia
adicional implementada. Backups JSON contêm os dados e anexos do usuário.

## Build e sincronização

```powershell
npm run sync
```

Verifica TypeScript, gera `dist` e copia os assets para os projetos Android/iOS.
Não configure `server.url`: o frontend é empacotado no aplicativo. Mudanças nas
telas compartilhadas exigem novo build/sync para chegar ao app instalado.

### Android

Configure Android Studio, Android SDK 36 e JDK 21. `JAVA_HOME` deve apontar para
o JDK 21; `ANDROID_HOME` ou `android/local.properties` deve apontar para o SDK.

```powershell
npm run sync
npm run android
```

No Android Studio, execute em aparelho/emulador ou gere um APK. Pelo terminal:

```powershell
cd android
.\gradlew.bat assembleDebug
```

Saída: `android/app/build/outputs/apk/debug/app-debug.apk`.

### iOS

Em Mac com Xcode, mantenha os dois diretórios lado a lado e execute `npm ci`,
`npm run sync` e `npm run ios`. Configure a equipe de assinatura no Xcode.
Os plugins usam Swift Package Manager. Compilação iOS exige macOS/Xcode.

Identificador atual: `com.jbmanagement.app`. Nome: `JB Management`. Ícones e splash
nativos ainda são os padrões do Capacitor; as telas usam o logo JB original.
Revise identificador, assets e assinatura antes de distribuir em lojas.

## Validação

```powershell
npm test
npm run check:screens
npm run build
```

Para repetir os fluxos completos no navegador, execute `npm run test:e2e`.
O comando faz o build, abre um servidor temporário na porta 5175 e testa cadastro
de obra, despesas, movimentação de tarefas, anexos e restauração em desktop e
celular (390 px). Reutiliza Playwright instalado no `jb-web-frontend`; no Windows
usa Edge. Em outros sistemas, instale o Chromium do Playwright no frontend.
`PW_CHANNEL` permite escolher outro canal instalado. Os perfis são isolados e
os registros são fictícios. Capturas ficam em `output/playwright`, ignorado pelo Git.

A tela de backup registra a data dos dados exportados somente após a confirmação
“Já salvei o arquivo”. Abrir ou cancelar o compartilhamento não registra uma cópia
salva. Alterações posteriores à exportação continuam pendentes. O lembrete aparece
no painel quando existem registros sem cópia confirmada, ou alterações após uma
cópia com sete dias ou mais; pode ser adiado por um dia. Restaurar um arquivo
reinicia esse histórico no aparelho, preservando os registros importados.

Testes de atualização abrem snapshots das versões 1 e 2 e comparam as coleções;
o teste de navegador também reabre uma base IndexedDB anterior. Isso simula a
compatibilidade dos dados, mas não substitui atualizar um APK/IPA instalado.

`check-mobile-recovery.cjs`, incluído em `test:e2e`, verifica erros de gravação
durante confirmação, adiamento e restauração do backup. Confere persistência
após falha, cancelamento e nova tentativa. Também salva um gasto em uma viewport
de 640 × 360 para verificar a rolagem do formulário. O teclado nativo ainda
precisa ser testado em aparelho físico.

Os testes cobrem banco vazio, CRUD, persistência, concorrência, validação,
migração, backup/restauração, falhas de gravação, anexos e bloqueio de rede.
O adaptador SQLite é testado com SQLite real do Node, incluindo Unicode, snapshots
grandes, migração e rollback. Isso não testa a ponte nativa do Capacitor.

`check:screens` renderiza as telas compartilhadas com estados vazios e dados de
teste, verifica a ausência de login/convites e inclui a página de backup.

A compilação APK/IPA, o SQLite via plugin e o seletor de arquivos precisam ser
validados no aparelho. O Android SDK não foi encontrado no ambiente de preparação;
nenhum binário nativo foi compilado aqui.

Roteiro no aparelho: instalar → modo avião → criar obra e empresa → lançar despesas
e receitas → criar/mover tarefa → anexar foto → fechar/reabrir → conferir dados →
exportar backup → restaurar em outra instalação. Conferir teclado, voltar do Android,
arquivos CSV, PDFs, fotos e áreas seguras.
