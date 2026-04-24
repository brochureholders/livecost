import type { Metadata } from "next";
import QuizClient from "@/components/urbrank/QuizClient";

export const metadata: Metadata = {
  title: "Where Should I Live? Quiz — UrbRank",
  description:
    "Take the 2-minute UrbRank quiz and get a personalized ranking of US cities based on your priorities — cost, climate, commute, schools, jobs, and more.",
  alternates: { canonical: "/quiz" },
  openGraph: {
    title: "Where Should I Live? Quiz",
    description: "Personalized US city rankings in 2 minutes.",
    type: "website",
  },
};

export default function QuizPage() {
  return <QuizClient />;
}
