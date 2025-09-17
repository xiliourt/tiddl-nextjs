'use client';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    message: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, onClose, onConfirm, message }) => {
    if (!isOpen) return null;

    return (
        <div className="confirm-dialog-popup">
            <div className="confirm-dialog-content">
                <p>{message}</p>
                <div className="confirm-dialog-buttons">
                    <button onClick={onConfirm} className="button">Yes</button>
                    <button onClick={onClose} className="button">No</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
