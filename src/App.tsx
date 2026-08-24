import { Panel } from './components/ui/Panel';
import { Button } from './components/ui/Button';

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Panel className="p-8 max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold text-graphite dark:text-stone mb-2">
          Note<span className="text-signal">Doco</span>
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Phase 0 foundation OK.
        </p>
        <Button variant="primary">Test Button</Button>
      </Panel>
    </div>
  );
}

export default App;
