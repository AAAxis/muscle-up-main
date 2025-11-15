
import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities'; // Keep existing import for User entity
import { ContractContent } from '@/api/entities'; // New import for ContractContent
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileSignature } from 'lucide-react';
import { motion } from 'framer-motion';
import SignatureCanvas from './SignatureCanvas';
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// Helper function to process gender-specific text
const processText = (text = '', gender) => {
    if (!text) return '';
    // This regex replaces [MALE]...[FEMALE]...[/MALE] with the appropriate gender text.
    // It handles the case where the text might contain newlines that need to be preserved or converted later.
    const processed = text.replace(/\[MALE\](.*?)\[FEMALE\](.*?)\[\/MALE\]/g, (match, maleText, femaleText) => {
        return gender === 'male' ? maleText : femaleText;
    });
    return processed;
};

export default function PersonalContract({ user, onContractSigned }) {
  const [fullName, setFullName] = useState(user?.name || user?.full_name || '');
  const [signatureData, setSignatureData] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // New states for dynamic contract content
  const [contractData, setContractData] = useState(null);
  const [isLoadingContract, setIsLoadingContract] = useState(true);
  const [checkedItems, setCheckedItems] = useState([]); // Initialized based on fetched contract

  // New state for signature dialog
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [tempSignatureData, setTempSignatureData] = useState('');

  const gender = user?.gender === 'female' ? 'female' : 'male';
  
  // These are derived from the contract content, but some parts are still hardcoded strings for the intro and partner.
  // The outline suggests removing some of these and using processText directly on contractData fields.
  // We'll keep 'agreeAndSignText' as it's a simple gender switch not found in dynamic content.
  const agreeAndSignText = gender === 'female' ? 'מסכימה וחותמת על החוזה' : 'מסכים וחותם על החוזה';

  // Effect to load contract content
  useEffect(() => {
    const loadContract = async () => {
        setIsLoadingContract(true);
        try {
            const results = await ContractContent.filter({ key: 'default' });
            if (results.length > 0) {
                setContractData(results[0]);
                // Initialize checkedItems based on the length of commitments from fetched data
                setCheckedItems(new Array(results[0].commitments.length).fill(false));
            } else {
                // Create default contract if it doesn't exist
                console.warn("No default contract found, creating default contract...");
                const defaultContract = {
                    key: 'default',
                    title: 'חוזה אישי - MUSCLE UP YAVNE',
                    instructions: 'אנא קרא/י בעיון את החוזה הבא וחתום/י עליו',
                    intro_paragraph: '[MALE]אני מתחייב[FEMALE]אני מתחייבת[/MALE] למלא את כל הסעיפים הבאים:',
                    commitment_header: 'התחייבויות:',
                    commitments: [
                        '[MALE]אבצע[FEMALE]אבצע[/MALE] את כל האימונים שנקבעו לי',
                        '[MALE]אשמור[FEMALE]אשמור[/MALE] על תזונה נכונה ומאוזנת',
                        '[MALE]אדווח[FEMALE]אדווח[/MALE] על התקדמותי באופן קבוע',
                        '[MALE]אשתף[FEMALE]אשתף[/MALE] פעולה עם המאמן שלי'
                    ],
                    success_paragraph: 'הצלחה היא מסע, לא יעד. יחד נגיע למטרות שלך!',
                    partnership_paragraph: 'אנחנו כאן כדי לתמוך בך בכל שלב. בואו נעבוד יחד להשגת המטרות שלך!'
                };
                const createdContract = await ContractContent.create(defaultContract);
                setContractData(createdContract);
                setCheckedItems(new Array(createdContract.commitments.length).fill(false));
            }
        } catch (err) {
            console.error("Error loading contract content:", err);
            setError("שגיאה בטעינת תוכן החוזה. אנא נסה שוב.");
        } finally {
            setIsLoadingContract(false);
        }
    };
    loadContract();
  }, []); // Run once on component mount

  // `allChecked` now depends on `contractData` to be loaded
  const allChecked = contractData ? checkedItems.every(Boolean) : false;
  const canSign = !!fullName.trim() && !!signatureData && allChecked;

  const handleCheckboxChange = (index) => {
    const newCheckedItems = [...checkedItems];
    newCheckedItems[index] = !newCheckedItems[index];
    setCheckedItems(newCheckedItems);
    setError(''); // Clear error when user interacts
  };

  const handleSign = async () => {
    setMessage('');
    setError('');

    if (!fullName.trim() || !signatureData) {
      setError("יש למלא את השם המלא ולחתום.");
      return;
    }
    if (!allChecked) {
      setError("יש לסמן את כל סעיפי ההתחייבות לפני החתימה.");
      return;
    }

    setIsUpdating(true);
    try {
      const contractDataToSign = {
        signature: signatureData,
        fullName: fullName
      };

      if (onContractSigned) {
        await onContractSigned(contractDataToSign);
      }
      
      setMessage('החוזה נחתם בהצלחה!');
    } catch (err) {
      console.error("Error signing contract:", err);
      setError("אירעה שגיאה בחתימת החוזה. אנא נסה שוב.");
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleOpenSignatureDialog = () => {
    setTempSignatureData(signatureData); // Pre-fill with existing signature for editing
    setIsSignatureDialogOpen(true);
  };

  const handleSaveSignature = () => {
    setSignatureData(tempSignatureData);
    setIsSignatureDialogOpen(false);
    setError(''); // Clear any signature-related errors
  };

  
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl"
      >
        <Card className="muscle-glass shadow-xl">
          {isLoadingContract || !contractData ? (
             <CardContent className="flex justify-center items-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                <p className="mr-2 text-gray-700">טוען חוזה...</p>
             </CardContent>
          ) : (
          <>
          <CardHeader className="text-center">
            <CardTitle className="text-center text-2xl">{contractData.title}</CardTitle>
            <CardDescription className="text-center">
              {processText(contractData.instructions, gender)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-lg border max-h-[50vh] overflow-y-auto" dir="rtl">
                <p className="text-lg mb-6 font-medium text-center" dangerouslySetInnerHTML={{ 
                    __html: `${processText(`[MALE]חותם[FEMALE]חותמת[/MALE]`, gender)} ${processText(contractData.intro_paragraph, gender).replace(/\n/g, '<br/>')}` 
                }} />

                <div className="mb-6">
                    <p className="text-lg font-semibold mb-4">{processText(contractData.commitment_header, gender)}</p>
                    <div className="space-y-4 text-base">
                        {contractData.commitments.map((item, index) => (
                            <div key={index} className="flex items-start gap-3">
                                <Checkbox
                                    id={`commitment-${index}`}
                                    checked={checkedItems[index]}
                                    onCheckedChange={() => handleCheckboxChange(index)}
                                    className="mt-1 flex-shrink-0"
                                    disabled={isUpdating}
                                />
                                <Label htmlFor={`commitment-${index}`} className="font-normal cursor-pointer">
                                    {processText(item, gender)}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 text-base">
                    <p className="flex items-start gap-2">
                    <span className="text-yellow-500 font-bold">🔸</span>
                    <span dangerouslySetInnerHTML={{ __html: processText(contractData.success_paragraph, gender).replace(/\n/g, '<br/>') }} />
                    </p>
                    <p className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold">🤝</span>
                    <span dangerouslySetInnerHTML={{ __html: processText(contractData.partnership_paragraph, gender).replace(/\n/g, '<br/>') }} />
                    </p>
                </div>
            </div>

            {message && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
                {message}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
                {error}
              </div>
            )}

            {/* Signature Input Section */}
            <div className="space-y-4 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
              <h3 className="text-lg font-semibold text-center text-blue-800">חתימה</h3>
              <div>
                <Label htmlFor="fullName">שם מלא (כפי שיופיע בחוזה) <span className="text-red-500">*</span></Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setError(''); // Clear error on change
                  }}
                  placeholder="הקלד את שמך המלא"
                  className="mb-4"
                  disabled={isUpdating}
                />
              </div>

              {/* Signature Area with Button */}
              <div>
                <Label>חתימה דיגיטלית <span className="text-red-500">*</span></Label>
                <div className="mt-2 p-4 border-2 border-dashed border-slate-300 rounded-lg bg-white min-h-[100px] flex items-center justify-center">
                  {signatureData ? (
                    <div className="text-center">
                      <img src={signatureData} alt="החתימה שלך" className="h-20 mx-auto border border-slate-200 rounded" />
                      <Button variant="link" onClick={handleOpenSignatureDialog} disabled={isUpdating}>
                        שנה חתימה
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" onClick={handleOpenSignatureDialog} disabled={isUpdating}>
                      <FileSignature className="w-4 h-4 ml-2" />
                      פתח חלון חתימה
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Final Sign Button */}
            <div className="pt-4">
              <Button
                type="button"
                onClick={handleSign}
                disabled={!canSign || isUpdating}
                className="w-full muscle-primary-gradient text-white text-lg py-6"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    חותם...
                  </>
                ) : (
                  <>
                    <FileSignature className="w-5 h-5 mr-2" />
                    אני {agreeAndSignText}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
          </>
          )} {/* End of conditional rendering for isLoadingContract */}
        </Card>

        <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>חתימה דיגיטלית</DialogTitle>
              <DialogDescription>
                אנא חתום/י בתיבה למטה באמצעות העכבר או האצבע.
              </DialogDescription>
            </DialogHeader>
            {/* Pass current tempSignatureData to SignatureCanvas for clear/reset functionality, if needed in future */}
            <SignatureCanvas onSave={setTempSignatureData} initialSignature={tempSignatureData} />
            <DialogFooter className="gap-2 sm:justify-start pt-4">
              <Button onClick={handleSaveSignature} disabled={!tempSignatureData}>שמור חתימה</Button>
              <Button variant="ghost" onClick={() => setIsSignatureDialogOpen(false)}>ביטול</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
