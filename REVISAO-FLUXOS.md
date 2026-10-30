# Revisão de fluxos — atualizada em 29/10/2026

## Continuação em 29/10/2026

- Configurações: tema claro, escuro e automático, persistência após recarregar e redução de animações. Verificados no navegador do app e na rota web `/settings`, com dados isolados. Dados e backup permanecem disponíveis na mesma página do app.
- Backend Docker: conflito da porta 3001 com outro projeto identificado; porta externa do JB alterada para 3002 (configurável por `JB_BACKEND_PORT`). Container recriado preservando volumes; serviço saudável, endpoints `/` e `/docs` retornando 200 e seis testes do backend aprovados no container.

- Reexecutados com sucesso: 20 testes de dados, `check:screens`, build do app e suíte `test:e2e` existente. O build do frontend web também passou.
- Novo `check-reports-calendar.cjs`, incluído em `test:e2e`, aprovado em 1280 px e 390 px, no fuso America/Sao_Paulo, com perfis isolados e registros fictícios.
- Relatórios: estado vazio, totais de orçamento/gastos/receitas, saldo decimal, tarefas pendentes/concluídas, filtro por obra e retorno a todas as obras, além da lista de gastos filtrada.
- Calendário: tarefas concluídas fora da lista de pendências, abertura do dia com duas obras, filtro por obra, fechamento do modal por botão/Escape, avanço de mês e retorno para Hoje.
- Endereços locais: conteúdo das duas obras e navegação para o detalhe correto.
- Android SDK ausente no caminho padrão e `adb` indisponível no PATH. A validação nativa continua pendente. Não houve mudanças nas regras de dados nem nas telas nesta continuação.

## Validado no ambiente Windows

Testes de interface executados no Edge com Playwright, em perfil isolado e com dados fictícios. O app usa IndexedDB nesse ambiente; isso não valida a ponte SQLite do iPhone.

- Criar obra sem orçamento e editar seu nome.
- Cadastrar gasto e receita, conferindo valores decimais persistidos.
- Criar tarefa, avançar sua etapa e cancelar exclusão.
- Enviar foto de progresso, recarregar e baixar a imagem.
- Importar CSV e conferir seu conteúdo na exportação.
- Criar e renomear empresa, vincular e desvincular obra sem excluí-la.
- Exportar backup, rejeitar arquivo inválido, exigir confirmação para restaurar e conferir dados após recarregar.
- Cancelar exclusão de obra e recuperar o formulário após falha simulada de gravação.
- Simular falha em uma de três receitas mensais: duas confirmadas, aviso de resultado parcial e bloqueio de reenvio para evitar duplicação.
- Abrir relatórios, calendário e endereços sem exceções JavaScript.

Também passaram os 20 testes de dados, a renderização das telas e o build do app.

## Proteção de dados e uso no celular

- Cadastro de tarefas: envio simultâneo gera uma única requisição, campos e fechamento ficam bloqueados enquanto salva, falha mantém o preenchimento e uma nova tentativa conclui. Cancelar preserva o rascunho somente enquanto a página permanece aberta. Verificado em 1280 px e 360 px, com capturas em temas claro e escuro.

- Painel de obras: busca sem acentos, ordenação por nome/maior gasto e combinação de situação com filtro de orçamento, em desktop e celular. Orçamento ausente e gasto exatamente no limite não são classificados como excedidos.

- Fluxos completos executados em 1280 px e 390 px, com perfis isolados.
- Data de backup atualizada somente após confirmação de cópia salva; falha de gravação permite tentar novamente.
- Alterações após o backup aparecem como pendentes, inclusive após recarregar.
- Lembrete adiado persiste; após falha, uma tentativa bem-sucedida remove o aviso e o erro anterior.
- Seleção de backup mostra o nome do arquivo; cancelar mantém os registros e uma nova seleção exige nova confirmação.
- Falha simulada no IndexedDB durante a restauração preserva registros em memória e após recarregar. Uma nova tentativa restaura o arquivo original.
- Base antiga é reaberta pela versão atual preservando a obra e seu identificador.
- Formulário de gastos permite alcançar o botão e salvar em 640 × 360. Reduzir a viewport não simula o teclado nativo.

## Executar novamente

Na pasta `H:\JB\jb-app`:

```powershell
npm run test:e2e
```

O comando faz o build e abre um servidor temporário na porta 5175. Os scripts reutilizam Playwright já disponível no frontend e o Edge instalado. Nenhum registro do perfil normal do usuário é alterado. O teste de recuperação injeta falhas apenas no perfil temporário.

## Pendente: iPhone físico

Não executado: não há iPhone acessível nem macOS/Xcode neste ambiente. A inspeção dos arquivos confirmou referências aos plugins SQLite, Filesystem e Share, além do manifesto de privacidade no projeto. Isso não comprova compilação ou funcionamento nativo.

Em um Mac, com os dois projetos lado a lado, executar `npm ci`, `npm run sync` e `npm run ios` dentro de `jb-app`. Configurar a equipe de assinatura no Xcode e executar em um iPhone de teste.

Use exclusivamente registros de teste e um backup separado:

1. Ativar modo avião. Criar obra, empresa, tarefa, gasto e receita.
2. Encerrar o app pelo seletor de aplicativos e reabri-lo; conferir todos os registros e valores.
3. Selecionar foto pela biblioteca e PDF pelo app Arquivos. Conferir prévia e abertura/compartilhamento dos anexos.
4. Exportar backup pelo compartilhamento do iOS e salvar em Arquivos. Conferir que o arquivo existe; cancelar o seletor também deve deixar o app utilizável.
5. Restaurar esse backup em uma instalação de teste, após conferir o aviso de substituição. Verificar registros e anexos, inclusive após encerrar/reabrir.
6. Testar teclado, rolagem dos formulários, menus de seleção, VoiceOver e aumento do tamanho do texto. Botões devem continuar acessíveis acima da área inferior do sistema.
7. Testar retrato/paisagem, voltar entre telas e retorno ao app após alternar para Arquivos/Fotos.

Registrar modelo, versão do iOS, versão do app e resultado por item. Não desinstalar uma instalação com dados reais para realizar o teste.

## Limites da revisão

Não foram testados aqui assinatura/distribuição iOS, SQLite via plugin, seletor nativo de arquivos, permissões de Fotos, VoiceOver real ou todos os fluxos de contas e compartilhamento do backend web. A cobertura adicional de relatórios, calendário e endereços acima usa o app local: não valida autenticação/loaders do servidor web, geocodificação, todas as agregações mensais/semanais nem viradas de mês e ano.
