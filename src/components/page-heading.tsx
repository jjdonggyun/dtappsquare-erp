export function PageHeading({
  eyebrow = "WORKSPACE",
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6">
      <p className="mb-2 text-[10px] font-semibold tracking-[.12em] text-muted-foreground">
        {eyebrow}
      </p>
      <h1 className="text-[25px] font-bold tracking-[-.04em]">{title}</h1>
      <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{description}</p>
    </header>
  );
}
