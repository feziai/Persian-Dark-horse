import { useState, type FormEvent } from 'react';
import { Bot, CornerDownLeft, LoaderCircle, Sparkles } from 'lucide-react';
import { Button, Card } from './ui-parts';

type Model = 'chatgpt' | 'claude' | 'gemini';
const models: { id: Model; label: string }[] = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini' },
];

export function AdminAiQuestions({ isRtl }: { isRtl: boolean }) {
  const [model, setModel] = useState<Model>('chatgpt');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<{ answer: string; model: string; question: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const ask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = question.trim();
    if (loading) return;
    if (!prompt) {
      setError(isRtl ? 'لطفاً پرسش خود را بنویسید.' : 'Enter a question to continue.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/admin/ai/ask', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, question: prompt }),
      });
      const data = await response.json() as { answer?: string; model?: string; error?: string };
      if (!response.ok || typeof data.answer !== 'string') {
        throw new Error(data.error || (isRtl ? 'پاسخی دریافت نشد. دوباره تلاش کنید.' : 'No answer was returned. Try again.'));
      }
      setResult({ answer: data.answer, model: data.model || model, question: prompt });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isRtl ? 'پرسش ارسال نشد.' : 'Could not send your question.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bot size={20} /></span>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="font-semibold">{isRtl ? 'پرسش از هوش مصنوعی' : 'AI questions'}</h2>
              <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">GAPGPT</span>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{isRtl ? 'مدل را انتخاب کنید و پرسش خود را از اینجا بفرستید.' : 'Choose a model and ask directly from Admin Studio.'}</p>
          </div>
        </div>
      </div>

      <form onSubmit={(event) => { void ask(event); }} className="mt-5 space-y-4">
        <fieldset disabled={loading}>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">{isRtl ? 'مدل' : 'MODEL'}</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label={isRtl ? 'انتخاب مدل' : 'Select model'}>
            {models.map((option) => (
              <button
                key={option.id}
                type="button"
                data-testid={`button-ai-model-${option.id}`}
                aria-pressed={model === option.id}
                onClick={() => setModel(option.id)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${model === option.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}
              >{option.label}</button>
            ))}
          </div>
        </fieldset>
        <label htmlFor="admin-ai-question" className="block text-sm font-medium">
          {isRtl ? 'پرسش شما' : 'Your question'}
          <textarea
            id="admin-ai-question"
            data-testid="input-ai-question"
            value={question}
            onChange={(event) => { setQuestion(event.target.value); if (error) setError(''); }}
            placeholder={isRtl ? 'چه چیزی می‌خواهید بدانید؟' : 'What would you like to know?'}
            rows={4}
            maxLength={10000}
            required
            disabled={loading}
            className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm font-normal leading-relaxed outline-none placeholder:text-muted-foreground/70 focus:border-primary disabled:opacity-60"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs tabular-nums text-muted-foreground">{question.length.toLocaleString()} / 10,000</span>
          <Button type="submit" data-testid="button-ask-ai" disabled={loading || !question.trim()} className="w-full sm:w-auto">
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <CornerDownLeft size={16} />}
            {loading ? (isRtl ? 'در حال دریافت پاسخ…' : 'Thinking…') : (isRtl ? 'ارسال پرسش' : 'Ask question')}
          </Button>
        </div>
      </form>

      {error && <div role="alert" data-testid="status-ai-error" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>}
      {loading && <div aria-label={isRtl ? 'در حال دریافت پاسخ' : 'Loading answer'} className="mt-6 space-y-3 border-t border-border pt-5">
        <div className="h-3 w-24 animate-pulse rounded bg-primary/15" />
        <div className="h-3 w-full animate-pulse rounded bg-primary/10" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-primary/10" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-primary/10" />
      </div>}
      {result && <section data-testid="text-ai-answer" aria-live="polite" className="mt-6 border-t border-border pt-5">
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-primary"><Sparkles size={15} /><span>{result.model} · {isRtl ? 'پاسخ' : 'ANSWER'}</span></div>
        <p className="mb-3 break-words text-sm text-muted-foreground">{result.question}</p>
        <div className="whitespace-pre-wrap break-words rounded-xl border border-border bg-background p-4 text-sm leading-7 text-foreground">{result.answer}</div>
      </section>}
    </Card>
  );
}