# Instalar o JB no celular

O aplicativo instalado funciona sem Docker, servidor, conta ou internet.
Internet é necessária para preparar as ferramentas e baixar dependências.
Use dados fictícios na primeira validação. Se já usa o JB, exporte um backup antes
de atualizar e mantenha a mesma assinatura; não desinstale para trocar o ícone.

## Android no Windows — caminho mais simples neste ambiente

1. Instale Android Studio 2025.2.1 ou mais recente. No SDK Manager, instale
   Android SDK Platform 36, Build Tools e Platform Tools. O projeto usa JDK 21,
   já encontrado neste computador. Configure esse JDK no Gradle do Android Studio.
2. Na pasta `H:\JB\jb-app`, execute:

   ```powershell
   npm run sync
   npm run android
   ```

3. No Android, ative Opções do desenvolvedor e Depuração USB. Conecte por cabo
   e aceite a autorização do computador. No Android Studio, selecione o aparelho
   e clique em Run. No Windows, alguns aparelhos precisam do driver USB do fabricante.
4. Quando o app abrir, desconecte o cabo e teste em modo avião.

Alternativa para enviar um APK de teste, após configurar SDK/JDK:

```powershell
cd H:\JB\jb-app\android
.\gradlew.bat assembleDebug
```

O arquivo será `app\build\outputs\apk\debug\app-debug.apk`.
Transfira para o Android, abra o arquivo e autorize a instalação por esse aplicativo
quando o sistema solicitar. Esse APK é para testes; publicação exige assinatura
de lançamento. O APK não pode ser instalado no iPhone.

## iPhone com acesso a um Mac

Use macOS com Xcode 26 ou mais recente e Node 22.12+. Copie os diretórios
`jb-app` e `jb-web-frontend` lado a lado para o Mac. No terminal, partindo da pasta
que contém ambos:

```sh
cd jb-web-frontend
npm ci
cd ../jb-app
npm ci
npm run sync
npm run ios
```

No Xcode:

1. Adicione sua Apple Account em Settings → Accounts.
2. No target App → Signing & Capabilities, habilite Automatically manage signing
   e selecione sua equipe ou Personal Team. Se o identificador não estiver
   disponível para sua conta, use um identificador próprio para a instalação de teste.
3. Conecte o iPhone, confirme a confiança no computador, selecione-o como destino
   e clique em Run. Ative Modo de Desenvolvedor no iPhone quando solicitado
   (Ajustes → Privacidade e Segurança).
4. Teste sem cabo e em modo avião, incluindo fechar/reabrir, anexos e backup.

É possível testar no próprio aparelho com uma conta gratuita (Personal Team),
mas o perfil expira após sete dias: será necessário assinar/instalar novamente
pelo Xcode. Preserve o identificador e os dados; não desinstale o aplicativo.

Sem Mac local, é necessário acesso a um Mac remoto ou serviço de compilação iOS
e um fluxo de assinatura/distribuição. TestFlight exige participação no Apple
Developer Program e envio do build ao App Store Connect. Não há IPA pronto neste
repositório. Para começar neste Windows, o Android tem menos etapas.

## O que já foi verificado

Ícones Android/iOS gerados e inspecionados, dimensões/transparência/margens
validadas, build web e `cap sync` concluídos. Não foram compilados APK/IPA nem
verificados os ícones no launcher de aparelhos físicos. O Android SDK/Studio
não foi encontrado neste computador; iOS precisa de macOS/Xcode.

Referências oficiais:
- [Ambiente Capacitor 8](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Executar em Android físico](https://developer.android.com/studio/run/device)
- [Apple Account e Personal Team](https://developer.apple.com/help/account/basics/about-your-developer-account)
- [TestFlight](https://developer.apple.com/testflight/)
