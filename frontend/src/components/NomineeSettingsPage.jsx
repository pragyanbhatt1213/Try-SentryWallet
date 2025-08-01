import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { 
  Shield, 
  UserPlus, 
  DollarSign, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Eye,
  Trash2,
  Send
} from 'lucide-react';
import WalletManager from './WalletManager';
import { getInheritanceContract, isValidAddress, getSigner } from '../utils/blockdag';
import { supabase } from '../utils/wallet';
import { useOutletContext } from 'react-router-dom';

const NomineeSettingsPage = () => {
  const { user } = useOutletContext();
  const [signer, setSigner] = useState(null);
  const [showWalletManager, setShowWalletManager] = useState(true);
  
  const [nomineeEmail, setNomineeEmail] = useState('');
  const [nomineeAddress, setNomineeAddress] = useState('');
  const [sharePercentage, setSharePercentage] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  
  const [currentNominee, setCurrentNominee] = useState(null);
  const [contractBalance, setContractBalance] = useState('0');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleWalletUnlocked = (unlockedWallet) => {
    const signerInstance = getSigner(unlockedWallet.privateKey);
    setSigner(signerInstance);
    setShowWalletManager(false);
  };

  const fetchData = useCallback(async () => {
    if (!signer) return;

    setIsLoading(true);
    setError('');

    try {
      const contract = getInheritanceContract(signer);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('nominee_email')
        .eq('id', user.id)
        .single();
      
      if (profileData?.nominee_email) {
        setNomineeEmail(profileData.nominee_email);
      }

      const share = await contract.nominees(signer.address);
      if (share.gt(0)) {
        setCurrentNominee({
          address: nomineeAddress, 
          share: share.toString()
        });
        setSharePercentage(share.toString());
      }

      const balance = await signer.provider.getBalance(contract.address);
      setContractBalance(ethers.utils.formatEther(balance));

    } catch (err) {
      setError('Could not fetch nominee information: ' + (err.reason || err.message));
      console.error("Error fetching data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [signer, user, nomineeAddress]);

  useEffect(() => {
    if (signer) {
      fetchData();
    }
  }, [signer, fetchData]);

  const handleSaveNominee = async (e) => {
    e.preventDefault();
    if (!signer) return;

    const contract = getInheritanceContract(signer);
    setIsSaving(true);
    setError('');
    setSuccess('');

    if (!isValidAddress(nomineeAddress)) {
      setError('Invalid nominee BlockDAG address.');
      setIsSaving(false);
      return;
    }
    
    const share = parseInt(sharePercentage);
    if (isNaN(share) || share <= 0 || share > 100) {
      setError('Share percentage must be a number between 1 and 100.');
      setIsSaving(false);
      return;
    }

    try {
      await supabase
        .from('profiles')
        .update({ nominee_email: nomineeEmail })
        .eq('id', user.id);

      const tx = await contract.setNominee(nomineeAddress, share);
      await tx.wait();

      setCurrentNominee({ address: nomineeAddress, share: sharePercentage });
      setSuccess('Nominee saved successfully on-chain and off-chain!');
      
      await fetchData();
    } catch (err) {
      setError(err.reason || err.message || 'Failed to save nominee. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFundContract = async (e) => {
    e.preventDefault();
    if (!signer || !fundAmount) return;

    const contract = getInheritanceContract(signer);
    setIsFunding(true);
    setError('');
    setSuccess('');

    try {
      const amount = ethers.utils.parseEther(fundAmount);
      const tx = await signer.sendTransaction({
        to: contract.address,
        value: amount
      });
      
      await tx.wait();
      setSuccess(`Successfully sent ${fundAmount} tBDAG to inheritance contract!`);
      setFundAmount('');
      
      await fetchData();
    } catch (err) {
      setError('Failed to fund contract: ' + (err.reason || err.message));
    } finally {
      setIsFunding(false);
    }
  };

  const handleRemoveNominee = async () => {
    if (!signer) return;

    const contract = getInheritanceContract(signer);
    setIsRemoving(true);
    setError('');
    setSuccess('');

    try {
      if (!isValidAddress(nomineeAddress)) {
        setError('Nominee address to remove is not specified or invalid.');
        setIsRemoving(false);
        return;
      }
      const tx = await contract.removeNominee(nomineeAddress);
      await tx.wait();

      setCurrentNominee(null);
      setNomineeAddress('');
      setSharePercentage('');
      setSuccess('Nominee removed successfully from the contract!');
      
      await fetchData();
    } catch (err) {
      setError('Failed to remove nominee: ' + (err.reason || err.message));
    } finally {
      setIsRemoving(false);
    }
  };

  if (showWalletManager || !signer) {
    return (
      <WalletManager 
        user={user} 
        onWalletUnlocked={handleWalletUnlocked}
        onBack={() => setShowWalletManager(false)} 
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary mr-3" />
        <span className="text-lg text-gray-600">Loading nominee information...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-accent/20 to-primary/20 rounded-3xl flex items-center justify-center">
          <Shield className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-4xl font-bold text-accent mb-4">Nominee Settings</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Manage your on-chain inheritance protocol. Set a nominee who can claim a portion of your funds if needed.
        </p>
      </motion.div>

      {error && (
        <motion.div
          className="mb-6 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl flex items-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <AlertCircle className="w-5 h-5 mr-3 text-red-600" />
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-600 hover:text-red-800 transition-colors"
          >
            ×
          </button>
        </motion.div>
      )}

      {success && (
        <motion.div
          className="mb-6 bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-2xl flex items-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <CheckCircle className="w-5 h-5 mr-3 text-green-600" />
          <span>{success}</span>
          <button
            onClick={() => setSuccess('')}
            className="ml-auto text-green-600 hover:text-green-800 transition-colors"
          >
            ×
          </button>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <motion.div
            className="neumorphic rounded-3xl p-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-xl font-semibold text-accent mb-4 flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Current Status
            </h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Contract Balance
                </label>
                <p className="text-2xl font-bold text-accent">
                  {parseFloat(contractBalance).toFixed(4)} <span className="text-lg font-medium text-gray-500">tBDAG</span>
                </p>
              </div>

              {currentNominee ? (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 rounded-xl">
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Active Nominee Address
                    </label>
                    <p className="text-accent font-medium font-mono text-sm break-all">
                      {currentNominee.address}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-xl">
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Share Percentage
                    </label>
                    <p className="text-accent font-bold text-lg">
                      {currentNominee.share}%
                    </p>
                  </div>
                  
                  <button
                    onClick={handleRemoveNominee}
                    disabled={isRemoving}
                    className="w-full flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 font-medium"
                  >
                    {isRemoving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Removing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5 mr-2" />
                        Remove Nominee
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-gray-100 rounded-xl text-center">
                  <p className="text-gray-600">No nominee currently set</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            className="neumorphic rounded-3xl p-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-xl font-semibold text-accent mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Fund Contract
            </h2>
            
            <form onSubmit={handleFundContract} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (tBDAG)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="0.1000"
                  required
                  disabled={isFunding}
                />
              </div>
              
              <button
                type="submit"
                disabled={isFunding || !fundAmount}
                className="w-full flex items-center justify-center px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 font-medium"
              >
                {isFunding ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Fund Contract
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>

        <div>
          <motion.div
            className="neumorphic rounded-3xl p-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h2 className="text-xl font-semibold text-accent mb-6 flex items-center">
              <UserPlus className="w-5 h-5 mr-2" />
              Set Nominee
            </h2>

            <form onSubmit={handleSaveNominee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nominee's Email Address (Off-chain)
                </label>
                <input
                  type="email"
                  value={nomineeEmail}
                  onChange={(e) => setNomineeEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="nominee@example.com"
                  required
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nominee's BlockDAG Address (On-chain)
                </label>
                <input
                  type="text"
                  value={nomineeAddress}
                  onChange={(e) => setNomineeAddress(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono text-sm"
                  placeholder="0x..."
                  required
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Share Percentage (1-100)
                </label>
                <input
                  type="number"
                  value={sharePercentage}
                  onChange={(e) => setSharePercentage(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="e.g., 50 for 50%"
                  required
                  min="1"
                  max="100"
                  disabled={isSaving}
                />
                <p className="text-xs text-gray-500 mt-1">
                  The percentage of funds the nominee can claim during recovery
                </p>
              </div>

              <button
                type="submit"
                disabled={isSaving || !signer}
                className="w-full flex items-center justify-center px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 font-medium"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Save Nominee On-Chain
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </div>

      <motion.div
        className="mt-8 text-center py-6 bg-gradient-to-r from-accent/5 to-primary/5 rounded-3xl border border-accent/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <h3 className="text-lg font-bold text-accent mb-2">
          SentryInheritance Smart Contract
        </h3>
        <p className="text-gray-600 font-mono text-sm break-all">
          {getInheritanceContract(signer)?.address}
        </p>
        <p className="text-gray-500 text-sm mt-2">
          Deployed on BlockDAG Primordial Testnet
        </p>
      </motion.div>
    </div>
  );
};

export default NomineeSettingsPage;