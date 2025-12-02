# 🌰 NOZES.ia - Identificação Biológica Inteligente

![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Gemini API](https://img.shields.io/badge/Powered%20by-Gemini%202.5-orange)
![Tailwind](https://img.shields.io/badge/Style-TailwindCSS-cyan)

> **NOZES** (ou *Nuts AI*) é uma plataforma moderna e responsiva para a criação, edição e visualização de chaves de identificação biológica (chaves matriciais).

Impulsionado pelo **Google Gemini 2.5 Flash**, o NOZES permite que biólogos, taxonomistas, estudantes e entusiastas gerem chaves complexas de identificação de espécies em segundos, apenas descrevendo um tópico.

---

## 🌿 Funcionalidades Principais

### 🧠 Nozes IA (AI Wizard)
O coração do projeto. Um assistente inteligente que gera estruturas taxonômicas completas.
- **Geração Automática:** Cria entidades (espécies), características e popula a matriz de estados automaticamente.
- **Filtros Inteligentes:** Defina restrições por geografia (ex: "Mata Atlântica"), taxonomia (ex: "Família Felidae") e foco morfológico (Vegetativo vs. Reprodutivo).
- **Multilíngue:** Gera conteúdo nativamente em **Português** ou **Inglês**.
- **Busca de Imagens:** Tenta encontrar URLs de imagens públicas para espécies e características.

### 🔨 Construtor de Matriz (Builder)
Uma interface rica para refinar os dados gerados pela IA ou criar chaves do zero.
- **Edição em Grade:** Visualize e edite a relação entre espécies e características em uma matriz intuitiva.
- **Gerenciamento de Mídia:** Adicione ou altere URLs de imagens para cada entidade.
- **Controle Total:** Adicione, remova ou modifique estados e características manualmente.

### 🔍 Player de Identificação
A interface para o usuário final utilizar a chave.
- **Filtragem em Tempo Real:** As espécies são filtradas instantaneamente à medida que o usuário seleciona características.
- **Feedback Visual:** Mostra espécies compatíveis e descartadas com clareza.
- **Responsivo:** Funciona perfeitamente em desktops, tablets e celulares (ideal para trabalho de campo).

### 💾 Persistência e Portabilidade
- **Armazenamento Local:** Seus projetos são salvos automaticamente no navegador via LocalStorage.
- **JSON Import/Export:** Compartilhe suas chaves exportando arquivos JSON leves.

---

## 🚀 Tecnologias Utilizadas

*   **Frontend:** [React 19](https://react.dev/)
*   **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
*   **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
*   **Inteligência Artificial:** [Google GenAI SDK](https://www.npmjs.com/package/@google/genai) (Gemini 2.5 Flash)
*   **Ícones:** [Lucide React](https://lucide.dev/)
*   **Build Tool:** Vite (Recomendado) ou Create React App.

---

## 🛠️ Instalação e Configuração

Para rodar o NOZES localmente, siga os passos abaixo:

### 1. Pré-requisitos
*   Node.js (v18 ou superior)
*   NPM ou Yarn
*   Uma API Key do Google AI Studio

### 2. Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/nozes-ia.git
cd nozes-ia
```

### 3. Instalar Dependências

```bash
npm install
```

### 4. Configurar Variáveis de Ambiente

O projeto utiliza a API do Google Gemini. Por segurança, a chave não deve ser hardcoded.

No ambiente de desenvolvimento (local), certifique-se de que a variável `process.env.API_KEY` esteja acessível ou configure seu bundler (Vite/Webpack) para injetá-la.

> **Nota:** Se estiver usando Vite, crie um arquivo `.env` na raiz:

```env
VITE_API_KEY=sua_chave_gemini_aqui
```
*(E ajuste a inicialização do `GoogleGenAI` no código para usar `import.meta.env.VITE_API_KEY` se necessário, ou configure o `define` no `vite.config.ts`).*

### 5. Executar o Projeto

```bash
npm start
# ou
npm run dev
```

Abra `http://localhost:3000` (ou a porta indicada) no seu navegador.

---

## 📖 Como Usar

1.  **Tela Inicial:** Escolha **"Criar / Editar Chave"** para começar um novo projeto ou carregue um exemplo.
2.  **Nozes IA:** Dentro do construtor, clique no botão dourado **"Nozes IA"**.
    *   Digite um tópico (ex: "Plantas Carnívoras").
    *   Ajuste os sliders de quantidade e foco.
    *   Clique em "Gerar Chave".
3.  **Refinamento:** Após a geração (aprox. 15-30s), você será levado à aba **Matriz**. Verifique se as associações feitas pela IA estão corretas.
4.  **Imagens:** Na aba **Entidades**, verifique se as imagens carregaram corretamente ou insira URLs manuais.
5.  **Testar:** Clique em **"Salvar & Testar"** para ir ao modo Player e tentar identificar uma espécie.

---

## 🎨 Design e UI

O NOZES adota uma estética **"Tropical Dark/Glassmorphism"**:
*   **Paleta de Cores:** Emerald, Teal e Slate para a interface base; Amber/Gold para destacar funcionalidades de IA.
*   **Background:** Elementos orgânicos e gradientes suaves para imersão.
*   **Tipografia:** Inter (Google Fonts) para legibilidade em telas pequenas.

---

## 🤝 Contribuição

Contribuições são bem-vindas! Se você é um biólogo com ideias de recursos ou um desenvolvedor querendo melhorar o código:

1.  Faça um Fork do projeto.
2.  Crie uma Branch para sua Feature (`git checkout -b feature/IncrivelRecurso`).
3.  Faça o Commit (`git commit -m 'Add some IncrivelRecurso'`).
4.  Push para a Branch (`git push origin feature/IncrivelRecurso`).
5.  Abra um Pull Request.

---

## 📄 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

<div align="center">

**NOZES.ia** — *Descascando a complexidade da taxonomia com IA.* 🌰

Desenvolvido com ❤️ e 🧠
</div>
