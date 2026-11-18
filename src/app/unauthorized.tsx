import SpaceError from "@/components/ui/SpaceError";

export default function Unauthorized() {
  return <SpaceError code={401} />;
}
