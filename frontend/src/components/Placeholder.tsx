interface Props {
  title: string;
  description: string;
  icon: string;
}

export default function Placeholder({ title, description, icon }: Props) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-icon">{icon}</div>
      <h2 className="placeholder-title">{title}</h2>
      <p className="placeholder-desc">{description}</p>
      <span className="coming-soon-badge">Coming Soon</span>
    </div>
  );
}
