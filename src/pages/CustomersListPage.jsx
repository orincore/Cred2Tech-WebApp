import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { caseService } from '../api/caseService';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import { toast } from 'react-hot-toast';

const CustomersListPage = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const data = await caseService.getAllCases();
      setCases(data);
    } catch (error) {
      toast.error('Failed to load customers/cases.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderStageBadge = (stage) => {
    switch (stage) {
      case 'DRAFT':
        return <Badge color="warning">Incomplete</Badge>;
      case 'LEAD_CREATED':
        return <Badge color="success">Active Case</Badge>;
      default:
        return <Badge color="gray">{stage}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Customers & Pipeline" 
        subtitle="Manage your MSME onboarding flow and drafted cases."
        actions={
          <button className="btn btn-primary" onClick={() => navigate('/customers/add')}>
            Add New Customer
          </button>
        }
      />

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading cases...</div>
        ) : cases.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center">
             <p className="mb-4 text-lg">No customers found.</p>
             <button className="btn btn-primary btn-lg" onClick={() => navigate('/customers/add')}>
               Add New Customer
             </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Case ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Business Entity
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PAN
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stage
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cases.map((c) => (
                <tr key={c.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{c.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.customer?.business_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.customer?.business_pan}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.product_type || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {renderStageBadge(c.stage)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {c.stage === 'DRAFT' && (
                      <button
                        onClick={() => navigate(`/customers/add?caseId=${c.id}`)}
                        className="text-primary-600 hover:text-primary-900 mr-4 font-semibold"
                      >
                        Resume Wizard
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/customers/${c.customer_id}`)}
                      className="text-primary-600 hover:text-primary-900 mr-4 font-semibold"
                    >
                      View Profile
                    </button>
                    {/* Placeholder for future delete capability */}
                    <button
                      className="text-gray-400 cursor-not-allowed hover:text-gray-500 font-semibold"
                      disabled
                      title="Delete (Coming Soon)"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CustomersListPage;
