import StoreShell from "@/components/StoreShell";
export default function AccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StoreShell>
      <div className="admin-access-content">{children}</div>
    </StoreShell>
  );
}
