import type { Work } from '@/types/work';
import Link from '../compat/link';
export default function LocalWorksMap({ works }: { works: Work[] }) {
  return <section className="panel">
    <h2>Endereços das obras</h2>
    <p>Endereços salvos neste aparelho.</p>
    {works.length ? <ul>{works.map(work => <li key={work.uuid}><Link href={`/works/${work.uuid}`}>{work.name}</Link><p>{work.address}</p></li>)}</ul> : <p>Nenhuma obra cadastrada.</p>}
  </section>;
}
