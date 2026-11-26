export function LogoInstitucional({
  clase = "",
  decorativo = false,
}: {
  clase?: string;
  decorativo?: boolean;
}) {
  return (
    <span
      className={`logo-institucional ${clase}`}
      role={decorativo ? undefined : "img"}
      aria-label={decorativo ? undefined : "Instituto Finney Miller"}
      aria-hidden={decorativo || undefined}
    />
  );
}

export function MarcaInstitucional() {
  return (
    <>
      <LogoInstitucional />
      <span>
        FyM <strong>Pass</strong>
      </span>
    </>
  );
}
