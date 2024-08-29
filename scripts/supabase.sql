create or replace function pual_graham_search (
  query_embedding vector(1536),
  similarity_threshold float,
  match_count int
)

returns table (
  id bigint,
  essay_title text,
  essay_url text,
  essay_date text,
  content text,
  content_tokens bigint,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    pual_graham.id,
    pual_graham.essay_url,
    pual_graham.essay_url,
    pual_graham.essay_date,
    pual_graham.content,
    pual_graham.content_tokens,
    1 - (pual_graham.embedding <=> query_embedding) as similarity
    from pual_graham
    where 1 - (pual_graham.embedding <=> query_embedding) > similarity_threshold
    order by pual_graham.embedding <=> query_embedding
    limit match_count;
    end;
    $$;