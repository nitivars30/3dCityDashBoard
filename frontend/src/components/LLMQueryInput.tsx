import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Lightbulb } from 'lucide-react';

interface LLMQueryInputProps {
  onQuery: (query: string) => Promise<void>;
  isLoading: boolean;
}

const LLMQueryInput = ({ onQuery, isLoading }: LLMQueryInputProps) => {
  const [query, setQuery] = useState('');

  const handleSubmit = async () => {
    if (query.trim() && !isLoading) {
      await onQuery(query.trim());
      setQuery('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const exampleQueries = [
    'highlight buildings over 100 feet',
    'show commercial buildings',
    'buildings in RC-G zoning',
    'buildings less than $500,000 in value',
    'show buildings built after 2010',
    'residential buildings over 5 floors'
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about the buildings... e.g., 'highlight buildings over 100 feet' or 'show commercial buildings'"
          className="min-h-[80px] resize-none"
          disabled={isLoading}
        />
        <Button
          onClick={handleSubmit}
          disabled={!query.trim() || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing Query...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Query Buildings
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lightbulb className="w-4 h-4" />
          Example queries:
        </div>
        <div className="flex flex-wrap gap-1">
          {exampleQueries.map((example, index) => (
            <Badge
              key={index}
              variant="outline"
              className="cursor-pointer hover:bg-muted text-xs"
              onClick={() => setQuery(example)}
            >
              {example}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LLMQueryInput;