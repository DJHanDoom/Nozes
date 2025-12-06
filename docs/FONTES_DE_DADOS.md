# Fontes de Dados e Processo de Geração do Nozes IA

Este documento detalha como o **Nozes IA** compila, gera e valida as informações biológicas e taxonômicas utilizadas para criar as chaves de identificação. O sistema opera em uma arquitetura híbrida, combinando Inteligência Artificial Generativa (para estruturação de conhecimento) com algoritmos determinísticos (para validação e busca de mídia).

## 1. Geração de Conhecimento Taxonômico (O "Cérebro")

A base textual das chaves (lista de espécies, características morfológicas e a matriz de estados) é gerada pelo modelo **Google Gemini** (via `GoogleGenAI`). O comportamento do sistema varia dependendo do modo de operação escolhido pelo usuário:

### A. Modo de Geração Automática (Prompt)
Neste modo, o sistema não realiza buscas na internet em tempo real. Ele acessa o **conhecimento latente** do modelo, adquirido durante seu treinamento massivo em literatura científica, floras digitais, artigos e bases de dados taxonômicos.

*   **O Prompt do "Expert":** O sistema injeta uma *System Instruction* rigorosa, definindo o modelo como um *"expert taxonomista e biólogo"*.
*   **Restrições Rígidas:** São aplicadas restrições de escopo geográfico (ex: "Bioma Cerrado"), taxonômico (ex: "Família Fabaceae") e de nível de detalhe.
*   **Estruturação:** O modelo é forçado a "despejar" seu conhecimento em um esquema JSON proprietário (`Project` interface), garantindo que o resultado seja uma matriz funcional e não apenas um texto corrido.

> **Nota:** Alucinações (erros factuais) podem ocorrer neste estágio se o conhecimento interno do modelo sobre um grupo específico for limitado ou contraditório.

### B. Modo de Importação (RAG - Retrieval-Augmented Generation)
Quando o usuário faz upload de um arquivo (PDF, Imagem ou Texto), o "cérebro" muda de foco.
*   **Fonte Exclusiva:** O modelo é instruído a extrair informações **apenas** do documento fornecido.
*   **Processamento:** O Gemini analisa o conteúdo visual ou textual, identifica padrões de chaves dicotômicas ou descrições morfológicas e as converte para o formato de matriz do Nozes.
*   **Prioridade:** Neste modo, o conhecimento prévio do modelo é suprimido em favor dos dados do arquivo, atuando mais como um interpretador/extrator do que como um gerador criativo.

---

## 2. Validação e Referências Externas (A "Prova Real")

Para mitigar o risco de alucinações da IA e permitir que o pesquisador valide os dados, o Nozes IA gera **automaticamente** e **deterministicamente** (sem uso de IA) uma série de links diretos para bases de dados oficiais.

O algoritmo (`generateEntityLinks` em `geminiService.ts`) captura o **Nome Científico** gerado pela IA, limpa-o, e constrói URLs de busca para os seguintes repositórios de biodiversidade:

### Bases de Dados Nacionais (Brasil)
1.  **Flora e Funga do Brasil (Reflora):**
    *   A fonte oficial da botânica brasileira. O link leva diretamente à busca pelo binômio específico.
    *   *URL:* `floradobrasil.jbrj.gov.br/consulta/busca.html?q={ScientificName}`
2.  **SIDOL (Sistema de Identificação Dendrológica Online):**
    *   Específico para espécies arbóreas brasileiras.
    *   *URL:* `sidol.com.br/busca?q={ScientificName}`
3.  **Flora Digital UFSC:**
    *   Base de dados rica em imagens da flora do sul do Brasil.
    *   *URL:* `floradigital.ufsc.br/busca.php?q={ScientificName}`

### Bases de Dados Globais
4.  **GBIF (Global Biodiversity Information Facility):**
    *   O maior agregador global de dados de biodiversidade. Essencial para verificar a ocorrência geográfica e sinonímias.
    *   *URL:* `gbif.org/species/search?q={ScientificName}`
5.  **iNaturalist / Biodiversity4All:**
    *   Rede de ciência cidadã. Excelente para verificar fotos de campo e fenologia recente.
    *   *URL:* `inaturalist.org/search?q={ScientificName}`
6.  **POWO (Plants of the World Online - Kew Gardens):**
    *   Referência taxonômica global, vital para confirmar nomes aceitos vs. sinônimos.
    *   *URL:* `powo.science.kew.org/results?q={ScientificName}`
7.  **Wikipedia:**
    *   Fonte secundária para informações gerais e nomes populares.

---

## 3. Obtenção de Imagens (Os "Olhos")

Diferente do texto, as imagens **não são geradas** pela IA (o que poderia criar plantas inexistentes). Elas são buscadas em tempo real através de APIs públicas, garantindo que o usuário veja fotos reais dos espécimes.

A ordem de prioridade de busca é projetada para favorecer a precisão científica:
1.  **iNaturalist / Biodiversity4All:** Prioritário por conter identificações validadas pela comunidade ("Research Grade").
2.  **Wikimedia Commons:** Fonte secundária de alta qualidade.
3.  **PlantNet:** Utilizado como fallback para identificação visual.
4.  **Flickr:** (Legado/Fallback).

---

## Resumo do Fluxo de Dados

1.  **Input do Usuário:** Tópico ou Arquivo.
2.  **Processamento (Gemini):** Gera a lista de espécies e a matriz de características (JSON).
3.  **Pós-Processamento (Algoritmo):**
    *   Extrai nomes científicos.
    *   Gera links de validação para 7+ bases de dados.
    *   Conecta-se a APIs de imagem para buscar fotos reais.
4.  **Output:** Chave Interativa + Links de Validação.
