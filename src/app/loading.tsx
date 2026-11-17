import Loader from "@/components/ui/Loader";

export default function Loading() {
  return (
    <main className="w-full flex-1" aria-busy="true">
      <Loader variant="page" />
    </main>
  );
}
