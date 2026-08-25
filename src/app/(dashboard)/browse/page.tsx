import DiscoverPage from "../discover/page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse & Discover Projects | ProjectMatch",
  description: "Browse open roles and projects ranked by AI matching compatibility.",
};

export default function BrowsePage() {
  return <DiscoverPage />;
}
