import { Route, Switch } from 'wouter';
import PromptList from '../components/prompt-studio/PromptList';
import PromptDetail from '../components/prompt-studio/PromptDetail';
import PromptProfile from '../components/prompt-studio/PromptProfile';
import PromptCreate from '../components/prompt-studio/PromptCreate';
import PromptGenerate from '../components/prompt-studio/PromptGenerate';

export default function ManikaPromptsPage() {
  return (
    <div className="fade-up mx-auto max-w-7xl space-y-8 pb-20">
      <Switch>
        <Route path="/prompt-studio/generate" component={PromptGenerate} />
        <Route path="/prompt-studio/new" component={PromptCreate} />
        <Route path="/prompt-studio/profile/:publicId" component={PromptProfile} />
        <Route path="/prompt-studio/:id" component={PromptDetail} />
        <Route path="/prompt-studio" component={PromptList} />
      </Switch>
    </div>
  );
}
