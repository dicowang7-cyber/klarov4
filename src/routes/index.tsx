import { createFileRoute } from "@tanstack/react-router";
import { PhotoEditor } from "@/components/editor/photo-editor";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <PhotoEditor />;
}
