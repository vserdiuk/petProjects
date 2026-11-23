import projects from "../../../projects.json";

type Project = {
  slug: string;
  title: string;
  description: string;
  icon?: string;
  status?: "in-progress" | "ready" | "archived";
};

const statusLabel: Record<NonNullable<Project["status"]>, string> = {
  "in-progress": "In progress",
  ready: "Ready",
  archived: "Archived",
};

export function App() {
  const list = (projects as Project[]).filter((p) => p.status !== "archived");
  return (
    <main className="page">
      <header>
        <h1>Pet projects</h1>
        <p className="muted">Small tools, each living in its own isolated app.</p>
      </header>
      <ul className="grid">
        {list.map((p) => (
          <li key={p.slug}>
            {/* Relative link: works at the domain root and in a sub-folder. */}
            <a className="card" href={`./${p.slug}/`}>
              <span className="icon" aria-hidden>{p.icon ?? "📦"}</span>
              <span className="title">{p.title}</span>
              <span className="desc">{p.description}</span>
              {p.status && <span className={`badge ${p.status}`}>{statusLabel[p.status]}</span>}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
