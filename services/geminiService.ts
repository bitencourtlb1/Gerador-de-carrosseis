
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { CsvRow, ApiResponse } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const model = "gemini-2.5-flash";

const getSystemPrompt = () => `
  Você é uma IA desenvolvida para criar carrosséis em imagem para Instagram e gerar frases para qualquer nicho.
  Seu objetivo é ajudar o usuário a produzir conteúdo infinito.
  Você opera em dois modos:
  1. IA gera as frases e o carrossel a partir do nicho/contexto.
  2. Usuário envia as frases (via CSV) e você gera o conceito visual do carrossel.
  Sua resposta DEVE ser um objeto JSON VÁLIDO e NADA MAIS. Não inclua markdown, explicações ou qualquer texto fora do objeto JSON.
`;

const getApiResponseSchema = () => ({
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING, description: 'ia ou csv' },
    language: { type: Type.STRING, description: 'pt, en, ou es' },
    carrosseis: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          nicho: { type: Type.STRING, nullable: true },
          contexto: { type: Type.STRING, nullable: true },
          estilo_fundo: { type: Type.STRING, nullable: true },
          paleta_cores: { type: Type.STRING, nullable: true },
          tipografia: { type: Type.STRING, nullable: true },
          cta_no_ultimo_slide: { type: Type.BOOLEAN, nullable: true },
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ordem: { type: Type.INTEGER },
                tipo: { type: Type.STRING, description: 'capa, conteudo, ou cta' },
                frase: { type: Type.STRING },
                instrucoes_layout: { type: Type.STRING },
                prompt_imagem: { type: Type.STRING },
              },
              required: ['ordem', 'tipo', 'frase', 'instrucoes_layout', 'prompt_imagem'],
            },
          },
        },
        required: ['id', 'slides'],
      },
    },
  },
  required: ['mode', 'language', 'carrosseis'],
});

const parseJsonResponse = (responseText: string): ApiResponse => {
  try {
    const cleanedText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(cleanedText) as ApiResponse;
  } catch (error) {
    console.error("Failed to parse Gemini response:", responseText);
    throw new Error("A resposta da IA não está em formato JSON válido.");
  }
};

export const generateCarouselsFromIA = async (params: any): Promise<ApiResponse> => {
  const userPrompt = `
    Gere ${params.carouselsCount} carrossel(eis) com as seguintes especificações:
    - Modo: ia
    - Idioma para as frases: ${params.phrasesLanguage}
    - Nicho: ${params.niche}
    - Contexto/Objetivo: ${params.context}
    - Tom: ${params.tone}
    - Quantidade de slides por carrossel: ${params.slidesCount}
    - Estilo de fundo: ${params.backgroundStyle}
    - Paleta de cores: ${params.colorPalette}
    - Estilo de tipografia: ${params.typography}
    - CTA no último slide: ${params.cta ? 'Sim' : 'Não'}
    ${params.cta ? `- Tipo de CTA: ${params.ctaType}` : ''}
    
    Regras para as frases:
    - A primeira frase deve ser a capa, com um gancho forte.
    - As frases intermediárias devem desenvolver a ideia.
    - A última frase deve ser um CTA (se solicitado) ou uma mensagem de impacto.
    - As frases devem ser curtas, diretas e adequadas ao nicho, contexto e tom.

    Para cada slide, gere:
    - 'ordem': número do slide.
    - 'tipo': 'capa', 'conteudo' ou 'cta'.
    - 'frase': o texto do slide.
    - 'instrucoes_layout': instruções claras de design (posição do texto, destaque, etc.).
    - 'prompt_imagem': um prompt detalhado para um gerador de imagens de IA, combinando o estilo de fundo, paleta, tipografia e o contexto do nicho para criar a imagem de fundo.
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: userPrompt,
    config: {
      systemInstruction: getSystemPrompt(),
      responseMimeType: "application/json",
      responseSchema: getApiResponseSchema(),
    },
  });

  return parseJsonResponse(response.text);
};


export const generateCarouselsFromCSV = async (csvData: CsvRow[], params: any): Promise<ApiResponse> => {
  const carouselsMap = csvData.reduce((acc, row) => {
    if (!acc[row.carrossel_id]) {
      acc[row.carrossel_id] = [];
    }
    acc[row.carrossel_id].push({ ordem: row.ordem_slide, frase: row.frase });
    return acc;
  }, {} as Record<string, { ordem: number; frase: string }[]>);

  Object.values(carouselsMap).forEach(slides => slides.sort((a, b) => a.ordem - b.ordem));

  const userPrompt = `
    Gere o conceito visual para os carrosséis definidos abaixo, com base nas frases fornecidas.
    - Modo: csv
    - Idioma da interface: ${params.language}
    - Estilo de fundo padrão para todos: ${params.backgroundStyle}
    - Paleta de cores padrão para todos: ${params.colorPalette}
    - Estilo de tipografia padrão para todos: ${params.typography}
    - CTA no último slide: ${params.cta ? 'Sim' : 'Não'}
    ${params.cta ? `- Tipo de CTA: ${params.ctaType}` : ''}

    Se CTA for 'Sim', adicione um slide de CTA ao final de cada carrossel com uma frase apropriada.

    Para cada slide de cada carrossel, gere:
    - 'ordem': número do slide.
    - 'tipo': 'capa' para o primeiro slide, 'conteudo' para os intermediários, 'cta' para o último se aplicável.
    - 'frase': use a frase fornecida.
    - 'instrucoes_layout': instruções claras de design (posição do texto, destaque, etc.).
    - 'prompt_imagem': um prompt detalhado para um gerador de imagens de IA, combinando o estilo de fundo, paleta, tipografia e o contexto do nicho para criar a imagem de fundo.

    Dados dos carrosséis:
    ${JSON.stringify(carouselsMap, null, 2)}
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: userPrompt,
    config: {
      systemInstruction: getSystemPrompt(),
      responseMimeType: "application/json",
      responseSchema: getApiResponseSchema(),
    },
  });

  return parseJsonResponse(response.text);
};

export const generateImage = async (prompt: string): Promise<string | null> => {
  try {
    const imageAi = new GoogleGenAI({ apiKey: API_KEY });
    const response = await imageAi.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:image/png;base64,${base64ImageBytes}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};