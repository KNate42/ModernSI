// All ideas with sorting and category filters. The cursor is an offset from the API.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { IdeaList } from "@/components/IdeaList";
import { PageHero } from "@/components/PageHero";
import { ApiError } from "@/lib/errors";
import { categoryLabels } from "@/lib/format";
import { firstParam, qs } from "@/lib/query";
import { apiGet } from "@/lib/server-api";
import type { IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Ideas" };

const sorts = [
  { value: "new", label: "Newest" },
  { value: "trending", label: "Trending" },
  { value: "closest", label: "Closest to review" },
];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function IdeasPage({ searchParams }: Props) {
  const params = await searchParams;
  const sortParam = firstParam(params.sort);
  const sort = sorts.some((item) => item.value === sortParam) ? sortParam! : "new";
  const categoryParam = firstParam(params.category);
  const category = categoryParam && categoryParam in categoryLabels ? categoryParam : undefined;
  const cursor = firstParam(params.cursor);

  let page: Page<IdeaCard>;
  try {
    page = await apiGet<Page<IdeaCard>>(`/api/ideas${qs({ sort, category, cursor, limit: 24 })}`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "bad_cursor") redirect(`/ideas${qs({ sort: sort === "new" ? undefined : sort, category })}`);
    throw error;
  }
  const threshold = page.items[0]?.vote_threshold;
  // "new" is the default sort, so it stays out of the URL
  const link = (changes: Record<string, string | undefined>) => {
    const next = { sort, category, ...changes };
    return `/ideas${qs({ ...next, sort: next.sort === "new" ? undefined : next.sort })}`;
  };

  return (
    <>
      <PageHero
        tone="sky" icon="ideas" eyebrow="Pitch it. Back it. Make it real." note="yours could be next"
        title={<>Ideas worth <span className="marker">backing</span></>}
        lead={`Pick one you would show up for and back it. ${threshold ? `At ${threshold} votes` : "With enough votes"} it goes to Student Government.`}
      >
        <Link className="btn btn-primary btn-large" href="/ideas/new">Pitch an idea<Icon name="arrow" /></Link>
      </PageHero>
      <div className="wrap page-body">
        <div className="filters">
          <nav className="chips" aria-label="Sort">
            <span className="chips-label" aria-hidden="true">Sort</span>
            {sorts.map((item) => (
              <Link key={item.value} className="chip" href={link({ sort: item.value })} aria-current={item.value === sort ? "page" : undefined}>{item.label}</Link>
            ))}
          </nav>
          <nav className="chips" aria-label="Category">
            <span className="chips-label" aria-hidden="true">Show</span>
            <Link className="chip" href={link({ category: undefined })} aria-current={!category ? "page" : undefined}>All</Link>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <Link key={value} className="chip" href={link({ category: value })} aria-current={value === category ? "page" : undefined}>{label}</Link>
            ))}
          </nav>
        </div>
        <IdeaList
          level={2} ideas={page.items} emptyAction={{ href: "/ideas/new", label: "Pitch the first one" }}
          empty={category ? "No ideas in this category yet." : "No ideas yet."}
        />
        <div className="pager">
          {cursor && <Link className="btn btn-small" href={link({})}>First page</Link>}
          {page.next_cursor && <Link className="btn btn-small" href={link({ cursor: page.next_cursor })}>Next page<Icon name="arrow" /></Link>}
        </div>
      </div>
    </>
  );
}
