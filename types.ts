
export type Language = 'pt' | 'en' | 'es';
export type GenerationMode = 'ia' | 'csv';

export interface Slide {
  ordem: number;
  tipo: 'capa' | 'conteudo' | 'cta';
  frase: string;
  instrucoes_layout: string;
  prompt_imagem: string;
}

export interface Carousel {
  id: string;
  nicho?: string;
  contexto?: string;
  estilo_fundo?: string;
  paleta_cores?: string;
  tipografia?: string;
  cta_no_ultimo_slide?: boolean;
  slides: Slide[];
}

export interface ApiResponse {
  mode: GenerationMode;
  language: Language;
  carrosseis: Carousel[];
}

export interface CsvRow {
  carrossel_id: string;
  ordem_slide: number;
  frase: string;
}
