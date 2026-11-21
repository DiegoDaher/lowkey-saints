export default function Spinner({
  label,
  announce = true,
}: {
  label?: string;
  announce?: boolean;
}) {
  return (
    <span
      className="circle-loader"
      role={announce && label ? "status" : undefined}
    >
      <span className="circle-loader__shape" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
}
