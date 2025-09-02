import { BuildingFilter } from '@/types/city';

// LLM Service for processing natural language queries
// Uses a simple pattern matching approach as fallback to Hugging Face Transformers

interface LLMResponse {
  filter: BuildingFilter | null;
  confidence: number;
  explanation: string;
}

// Pattern matching rules for common queries
const QUERY_PATTERNS = [
  {
    pattern: /buildings?\s+(?:over|above|greater than|>)\s*(\d+)\s*(?:feet|ft|meters?|m)/i,
    attribute: 'height' as const,
    operator: '>' as const,
    valueExtractor: (match: RegExpMatchArray) => {
      const value = parseInt(match[1]);
      // Convert feet to meters if needed
      const unit = match[0].toLowerCase();
      return unit.includes('feet') || unit.includes('ft') ? value * 0.3048 : value;
    }
  },
  {
    pattern: /buildings?\s+(?:under|below|less than|<)\s*(\d+)\s*(?:feet|ft|meters?|m)/i,
    attribute: 'height' as const,
    operator: '<' as const,
    valueExtractor: (match: RegExpMatchArray) => {
      const value = parseInt(match[1]);
      const unit = match[0].toLowerCase();
      return unit.includes('feet') || unit.includes('ft') ? value * 0.3048 : value;
    }
  },
  {
    pattern: /(?:commercial|office|retail)\s+buildings?/i,
    attribute: 'buildingType' as const,
    operator: 'contains' as const,
    valueExtractor: () => 'Commercial'
  },
  {
    pattern: /residential\s+buildings?/i,
    attribute: 'buildingType' as const,
    operator: 'contains' as const,
    valueExtractor: () => 'Residential'
  },
  {
    pattern: /buildings?\s+in\s+([A-Z]{1,3}-[A-Z0-9]{1,3})\s+zoning/i,
    attribute: 'zoning' as const,
    operator: '=' as const,
    valueExtractor: (match: RegExpMatchArray) => match[1]
  },
  {
    pattern: /buildings?\s+(?:worth|valued at|less than|under)\s*\$?([\d,]+)/i,
    attribute: 'assessedValue' as const,
    operator: '<' as const,
    valueExtractor: (match: RegExpMatchArray) => parseInt(match[1].replace(/,/g, ''))
  },
  {
    pattern: /buildings?\s+(?:worth|valued at|more than|over|above)\s*\$?([\d,]+)/i,
    attribute: 'assessedValue' as const,
    operator: '>' as const,
    valueExtractor: (match: RegExpMatchArray) => parseInt(match[1].replace(/,/g, ''))
  },
  {
    pattern: /buildings?\s+built\s+(?:after|since)\s+(\d{4})/i,
    attribute: 'yearBuilt' as const,
    operator: '>=' as const,
    valueExtractor: (match: RegExpMatchArray) => parseInt(match[1])
  },
  {
    pattern: /buildings?\s+built\s+(?:before|prior to)\s+(\d{4})/i,
    attribute: 'yearBuilt' as const,
    operator: '<' as const,
    valueExtractor: (match: RegExpMatchArray) => parseInt(match[1])
  },
  {
    pattern: /buildings?\s+(?:with|having)\s+(?:over|more than|above)\s+(\d+)\s+floors?/i,
    attribute: 'floors' as const,
    operator: '>' as const,
    valueExtractor: (match: RegExpMatchArray) => parseInt(match[1])
  },
  {
    pattern: /(?:industrial|warehouse|factory)\s+buildings?/i,
    attribute: 'buildingType' as const,
    operator: 'contains' as const,
    valueExtractor: () => 'Industrial'
  },
  {
    pattern: /mixed.use\s+buildings?/i,
    attribute: 'buildingType' as const,
    operator: 'contains' as const,
    valueExtractor: () => 'Mixed Use'
  }
];

const processWithPatternMatching = (query: string): LLMResponse => {
  const normalizedQuery = query.toLowerCase().trim();
  
  for (const pattern of QUERY_PATTERNS) {
    const match = normalizedQuery.match(pattern.pattern);
    if (match) {
      const value = pattern.valueExtractor(match);
      return {
        filter: {
          attribute: pattern.attribute,
          operator: pattern.operator,
          value: value
        },
        confidence: 0.85,
        explanation: `Matched pattern: "${pattern.pattern.source}"`
      };
    }
  }
  
  return {
    filter: null,
    confidence: 0,
    explanation: 'No matching pattern found for the query'
  };
};

// Fallback to Hugging Face Transformers (client-side)
let transformersLoaded = false;
let pipeline: any = null;

const loadTransformers = async () => {
  if (transformersLoaded) return pipeline;
  
  try {
    // Dynamic import to avoid loading transformers unless needed
    const { pipeline: createPipeline } = await import('@huggingface/transformers');
    
    // Use a lightweight text classification model
    pipeline = await createPipeline(
      'text-classification',
      'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
    );
    
    transformersLoaded = true;
    console.log('Hugging Face Transformers loaded successfully');
    return pipeline;
  } catch (error) {
    console.warn('Failed to load Hugging Face Transformers:', error);
    return null;
  }
};

const processWithTransformers = async (query: string): Promise<LLMResponse> => {
  try {
    const model = await loadTransformers();
    if (!model) {
      throw new Error('Transformers not available');
    }
    
    // For now, fallback to pattern matching
    // In a real implementation, you would use a more sophisticated approach
    // such as fine-tuning a model for building query classification
    
    return processWithPatternMatching(query);
  } catch (error) {
    console.warn('Transformers processing failed, using pattern matching:', error);
    return processWithPatternMatching(query);
  }
};

export const processLLMQuery = async (query: string): Promise<BuildingFilter | null> => {
  try {
    console.log('Processing LLM query:', query);
    
    // First try pattern matching (fast and reliable)
    const patternResult = processWithPatternMatching(query);
    
    if (patternResult.filter && patternResult.confidence > 0.7) {
      console.log('Query processed with pattern matching:', patternResult);
      return patternResult.filter;
    }
    
    // Fallback to transformers for more complex queries
    const transformersResult = await processWithTransformers(query);
    
    if (transformersResult.filter && transformersResult.confidence > 0.6) {
      console.log('Query processed with transformers:', transformersResult);
      return transformersResult.filter;
    }
    
    console.warn('Could not process query:', query);
    return null;
    
  } catch (error) {
    console.error('Error processing LLM query:', error);
    return null;
  }
};

// Helper function to validate and normalize filter values
export const normalizeFilter = (filter: BuildingFilter): BuildingFilter | null => {
  try {
    // Validate attribute exists
    const validAttributes = ['height', 'assessedValue', 'zoning', 'buildingType', 'yearBuilt', 'floors', 'area', 'address'];
    if (!validAttributes.includes(filter.attribute)) {
      return null;
    }
    
    // Validate operator
    const validOperators = ['>', '<', '=', '>=', '<=', '!=', 'contains'];
    if (!validOperators.includes(filter.operator)) {
      return null;
    }
    
    // Normalize numeric values
    if (['height', 'assessedValue', 'yearBuilt', 'floors', 'area'].includes(filter.attribute)) {
      const numValue = Number(filter.value);
      if (isNaN(numValue)) {
        return null;
      }
      filter.value = numValue;
    }
    
    return filter;
  } catch (error) {
    console.error('Error normalizing filter:', error);
    return null;
  }
};

// Generate example queries for user guidance
export const getExampleQueries = (): string[] => {
  return [
    'show buildings over 100 feet tall',
    'highlight commercial buildings',
    'buildings in RC-G zoning',
    'buildings worth less than $500,000',
    'show buildings built after 2010',
    'residential buildings with more than 5 floors',
    'industrial buildings in the area',
    'mixed use buildings',
    'buildings under 50 meters',
    'office buildings over $1,000,000'
  ];
};