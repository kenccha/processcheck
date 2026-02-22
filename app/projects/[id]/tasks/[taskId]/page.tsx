"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
export function generateStaticParams() { return []; }
export default function Redirect() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => { router.replace(`/task?projectId=${params.id}&taskId=${params.taskId}`); }, [params.id, params.taskId, router]);
  return null;
}
