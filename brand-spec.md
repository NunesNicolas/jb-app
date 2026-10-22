# JB — extensão para aplicativo

Reutilização do sistema visual existente, autorizada pelo pedido de manter o frontend igual ao web.
Sem redesign: cores, tipografia, espaçamentos, raios, sombras e componentes vêm diretamente de
`../jb-web-frontend/src/styles/{globals,usability,select}.css` e das telas originais.

- Logo: `../jb-web-frontend/public/jblogo.png` (incluído no build).
- Referências existentes: `../jb-tasks-mobile.png`, `../jb-tasks-desktop.png`.
- Primária: `#b94708`; fundo: `#f5f6f8`; texto: `#1d1d1f`.
- Modo: extensão; fidelidade à marca 10/10; variação visual 1/10; movimento 1/10;
  densidade 7/10; dependência de assets 4/10.
- Uso: gestão de obras no celular; preservar hierarquia, rótulos e navegação.
- Exceções explícitas: entrada direta nas obras, dados e backup, endereço manual e lista offline.
- As áreas seguras do celular recebem ajustes apenas no CSS do app.
