import React, { useState } from 'react';
import { Lock, Info } from 'lucide-react';

interface AwsSsoConfigProps {
  onConfigComplete: (config: {
    startUrl: string;
    clientId: string;
    region?: string;
    accountId?: string;
    roleName?: string;
  }) => Promise<void>;
  error?: string;
}

export const AwsSsoConfigComponent: React.FC<AwsSsoConfigProps> = ({ 
  onConfigComplete,
  error 
}) => {
  const [formData, setFormData] = useState({
    startUrl: '',
    clientId: '',
    region: 'us-east-1',
    accountId: '',
    roleName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.startUrl || !formData.clientId) {
      alert('Start URL and Client ID are required');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfigComplete(formData);
    } catch (submitError) {
      console.error('AWS SSO Configuration Error:', submitError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white/10 rounded-2xl p-6 border border-white/20">
      <div className="flex items-center mb-6">
        <Lock className="w-8 h-8 mr-3 text-blue-400" />
        <h2 className="text-2xl font-semibold text-white">
          Configure AWS SSO
        </h2>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-3 rounded-lg mb-4 flex items-start">
          <Info className="w-5 h-5 mr-3 mt-1 text-red-400" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="startUrl" 
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            AWS SSO Start URL *
          </label>
          <input
            type="url"
            id="startUrl"
            name="startUrl"
            value={formData.startUrl}
            onChange={handleInputChange}
            required
            placeholder="https://your-company.awsapps.com/start"
            className="w-full bg-white/10 border border-white/20 rounded-lg 
              p-2 text-white placeholder-gray-500 
              focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 
              transition-all duration-300"
          />
          <p className="text-xs text-gray-400 mt-1">
            This is the URL you use to log into AWS SSO
          </p>
        </div>

        <div>
          <label 
            htmlFor="clientId" 
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            AWS SSO Client ID *
          </label>
          <input
            type="text"
            id="clientId"
            name="clientId"
            value={formData.clientId}
            onChange={handleInputChange}
            required
            placeholder="client-id-from-aws-sso"
            className="w-full bg-white/10 border border-white/20 rounded-lg 
              p-2 text-white placeholder-gray-500 
              focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 
              transition-all duration-300"
          />
          <p className="text-xs text-gray-400 mt-1">
            Found in AWS SSO Application configuration
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label 
              htmlFor="region" 
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              AWS Region
            </label>
            <input
              type="text"
              id="region"
              name="region"
              value={formData.region}
              onChange={handleInputChange}
              placeholder="us-east-1"
              className="w-full bg-white/10 border border-white/20 rounded-lg 
                p-2 text-white placeholder-gray-500 
                focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 
                transition-all duration-300"
            />
          </div>

          <div>
            <label 
              htmlFor="accountId" 
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              AWS Account ID
            </label>
            <input
              type="text"
              id="accountId"
              name="accountId"
              value={formData.accountId}
              onChange={handleInputChange}
              placeholder="123456789012"
              className="w-full bg-white/10 border border-white/20 rounded-lg 
                p-2 text-white placeholder-gray-500 
                focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 
                transition-all duration-300"
            />
          </div>
        </div>

        <div>
          <label 
            htmlFor="roleName" 
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            AWS Role Name
          </label>
          <input
            type="text"
            id="roleName"
            name="roleName"
            value={formData.roleName}
            onChange={handleInputChange}
            placeholder="YourAdminRole"
            className="w-full bg-white/10 border border-white/20 rounded-lg 
              p-2 text-white placeholder-gray-500 
              focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 
              transition-all duration-300"
          />
          <p className="text-xs text-gray-400 mt-1">
            Optional: Specific role to assume after SSO login
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`
            w-full py-3 rounded-lg text-white font-semibold 
            bg-blue-600 hover:bg-blue-700 
            transition-colors duration-300
            flex items-center justify-center
            ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          ) : null}
          Save AWS SSO Configuration
        </button>
      </form>

      <div className="mt-4 text-xs text-gray-400 text-center">
        <p>
          * Required fields. This information is securely stored and used 
          only for AWS SSO authentication.
        </p>
      </div>
    </div>
  );
};

export default AwsSsoConfigComponent;