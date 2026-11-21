import Loader from "@/components/ui/Loader";
export default function Loading() {
  return (
    <div className="w-full" aria-busy="true">
      <Loader variant="page" label="Cargando administración…" />
    </div>
  );
}
