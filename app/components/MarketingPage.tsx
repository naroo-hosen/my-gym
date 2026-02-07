type ExpiringMember = {
  id: number;
  name: string;
  phone: string;
  expiresAt: string;
};

type ExpiringBucket = {
  label: string;
  days: number;
  members: ExpiringMember[];
};

type MarketingPageProps = {
  buckets: ExpiringBucket[];
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
};

const renderTable = (members: ExpiringMember[]) => {
  if (!members.length) {
    return <p className="empty">해당 없음</p>;
  }

  return (
    <div className="table-wrap">
      <table className="member-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>연락처</th>
            <th className="number">만료일</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>{member.name}</td>
              <td>{member.phone}</td>
              <td className="number">{formatDate(member.expiresAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const MarketingPage = ({ buckets }: MarketingPageProps) => (
  <section className="marketing">
    <header className="marketing-header">
      <div>
        <h2>마케팅</h2>
        <p className="marketing-subtitle">
          만료 예정 회원에게 안내 메시지를 보낼 수 있도록 기간별로 정리했습니다.
        </p>
      </div>
    </header>
    <div className="marketing-grid">
      {buckets.map((bucket) => (
        <section className="panel marketing-panel" key={bucket.days}>
          <div className="panel-header">
            <h3>{bucket.label}</h3>
            <span className="count">{bucket.members.length}명</span>
          </div>
          {renderTable(bucket.members)}
        </section>
      ))}
    </div>
  </section>
);

export default MarketingPage;
