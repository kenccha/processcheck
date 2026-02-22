"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
export function generateStaticParams() { return []; }
export default function Redirect() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => { router.replace(`/project?id=${params.id}`); }, [params.id, router]);
  return null;
}
