// ContentForge core types. This folder is a self-contained package
// (located at server/_core/contentforge/) that can be lifted into
// packages/contentforge/ in another project without modification.
// No runtime deps beyond @google/generative-ai.

export type BlockType =
  | "concept" | "example" | "quick_check" | "multiple_choice"
  | "true_false" | "fill_blank" | "drag_order" | "match_pairs"
  | "scenario_choice" | "reflection";

export interface ConceptBlock { title: string; body: string; imageQuery?: string; imageUrl?: string; }
export interface ExampleBlock { scenario: string; takeaway: string; imageQuery?: string; imageUrl?: string; }
export interface QuickCheckBlock { question: string; options: string[]; correctIndex: number; explanation: string; }
export interface MultipleChoiceBlock { question: string; options: string[]; correctIndex: number; explanation: string; }
export interface TrueFalseBlock { statement: string; answer: boolean; explanation: string; }
export interface FillBlankBlock { template: string; correctAnswers: string[]; wordBank: string[]; explanation: string; }
export interface DragOrderBlock { instruction: string; items: string[]; correctOrder: string[]; explanation: string; }
export interface MatchPairsBlock { instruction: string; leftItems: string[]; rightItems: string[]; correctPairs: number[][]; explanation: string; }
export interface ScenarioChoiceBlock { scenario: string; question: string; choices: Array<{ text: string; outcome: string; isBest: boolean }>; }
export interface ReflectionBlock { question: string; guidance: string; }

export type BlockContent =
  | { type: "concept"; data: ConceptBlock }
  | { type: "example"; data: ExampleBlock }
  | { type: "quick_check"; data: QuickCheckBlock }
  | { type: "multiple_choice"; data: MultipleChoiceBlock }
  | { type: "true_false"; data: TrueFalseBlock }
  | { type: "fill_blank"; data: FillBlankBlock }
  | { type: "drag_order"; data: DragOrderBlock }
  | { type: "match_pairs"; data: MatchPairsBlock }
  | { type: "scenario_choice"; data: ScenarioChoiceBlock }
  | { type: "reflection"; data: ReflectionBlock };

export interface Lesson { title: string; estimatedMinutes: number; blocks: BlockContent[]; }
export interface Unit { title: string; description: string; icon: string; lessons: Lesson[]; }
export interface Course {
  title: string;
  description: string;
  coverImageQuery: string;
  totalEstimatedMinutes: number;
  units: Unit[];
  finalExam: MultipleChoiceBlock[];
}

export interface GenerateOptions {
  topic: string;
  audience: string;
  duration: number;
  difficulty: "basico" | "intermediario" | "avancado";
  language: "pt-BR";
  pedagogy: "duolingo";
  llmProvider: "gemini";
  llmApiKey: string;
  numUnits?: number;
  onProgress?: (percent: number, message: string) => void | Promise<void>;
}
