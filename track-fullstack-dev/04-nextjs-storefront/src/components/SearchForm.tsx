export function SearchForm({ defaultValue = '' }: { defaultValue?: string }) {
  // Plain GET form: works without JavaScript and produces a shareable SSR URL.
  return (
    <form action="/search" role="search" className="search">
      <label htmlFor="q">Search products</label>
      <input id="q" name="q" type="search" defaultValue={defaultValue} placeholder="e.g. headphones" />
      <button type="submit">Search</button>
    </form>
  );
}
