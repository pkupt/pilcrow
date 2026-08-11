import { useSignal } from '@preact/signals';
import { workspace } from '../store/workspace';

export function SearchPanel() {
  const query = useSignal('');
  const isRegex = useSignal(false);
  const caseSensitive = useSignal(false);
  const loading = useSignal(false);

  const runSearch = async () => {
    if (!query.value.trim()) return;
    loading.value = true;
    try {
      await workspace.runSearch({
        pattern: query.value,
        isRegex: isRegex.value,
        caseSensitive: caseSensitive.value,
        fileGlob: null,
      });
    } finally {
      loading.value = false;
    }
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') void runSearch();
  };

  const jumpTo = (path: string) => {
    void workspace.openFile(path);
  };

  return (
    <div class="search-panel">
      <input
        type="text"
        placeholder="Search..."
        value={query.value}
        onInput={(e) => (query.value = (e.target as HTMLInputElement).value)}
        onKeyDown={handleKey}
      />
      <label>
        <input
          type="checkbox"
          checked={isRegex.value}
          onChange={(e) => (isRegex.value = (e.target as HTMLInputElement).checked)}
        />
        Regex
      </label>
      <label>
        <input
          type="checkbox"
          checked={caseSensitive.value}
          onChange={(e) => (caseSensitive.value = (e.target as HTMLInputElement).checked)}
        />
        Case
      </label>
      {loading.value && <span>searching...</span>}
      <ul class="search-results">
        {workspace.searchResults.value.map((hit, i) => (
          <li key={i} onClick={() => jumpTo(hit.path)}>
            <div class="result-path">{hit.path}:{hit.line}</div>
            <div class="result-line">{hit.lineText}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
