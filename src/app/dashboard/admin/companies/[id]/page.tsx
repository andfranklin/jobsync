import { getCompanyById } from "@/actions/company.actions";
import CompanyDetails from "@/components/admin/CompanyDetails";

async function CompanyDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompanyById(id);

  return (
    <div className="col-span-3">
      <CompanyDetails company={company} />
    </div>
  );
}

export default CompanyDetailsPage;
