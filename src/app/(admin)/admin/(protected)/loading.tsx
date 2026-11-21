import { AdminLoading } from "@/components/admin/AdminFeedback";
export default function Loading() {
  return (
    <div className="p-6 md:p-10">
      <AdminLoading initial label="Cargando administración…" />
    </div>
  );
}
