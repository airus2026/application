// Global variables
let currentStep = 0;
let totalSteps = 0;
let formData = {};

// Google Apps Script deployment URL - Replace with your own
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby6-XHGIZvVUN0HUNpwnu7dj2fncPLtZesz32H37kgSYqqOeLwylTwyrydWj1WFTNUVCw/exec";

// Initialize form
document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
    setupEventListeners();
});

function initializeForm() {
    totalSteps = document.querySelectorAll('.step').length;

    // Add default values for demo
    document.getElementById('satsNo').value = '123456';
    document.getElementById('stream').value = 'Commerce - SEBA';

    // Auto-generate admission number when SATS number changes
    document.getElementById('satsNo').addEventListener('change', generateAdmissionNumber);
    
    // Initialize mark limits based on default board
    updateMarkLimits();
    
    // Auto-format mobile number
    document.getElementById('mobile').addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
    });
    
    // Auto-format Aadhaar
    document.getElementById('aadhaar').addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 12);
    });
    
    // Force capital letters for student name
    document.getElementById('studentName').addEventListener('input', function() {
        this.value = this.value.toUpperCase().replace(/[^A-Z\s]/g, '');
    });
    
    // Calculate percentage
    document.getElementById('marksObtained').addEventListener('change', calculatePercentage);
    document.getElementById('totalMarks').addEventListener('change', calculatePercentage);
    
    // Calculate percentage and update mark limits when board changes
    document.getElementById('board').addEventListener('change', function() {
        updateMarkLimits();
        calculatePercentage();
    });

    // Update mark limits and calculate percentage when medium changes
    document.getElementById('academicMedium').addEventListener('change', function() {
        updateMarkLimits();
        calculatePercentage();
    });
    
    // SSLC Subject Marks validation and auto-calculate percentage
    const sslcMarksFields = ['lang1Marks', 'lang2Marks', 'lang3Marks', 'mathMarks', 'scienceMarks', 'socialScienceMarks'];
    sslcMarksFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', function() {
                validateField(field);
                calculatePercentage();
            });
            field.addEventListener('input', function() {
                const max = field.max || 100;
                const value = parseFloat(field.value);
                if (value > max) field.value = max;
            });
            field.addEventListener('change', calculatePercentage);
        }
    });
    
    // Form submission
    document.getElementById('admissionForm').addEventListener('submit', submitForm);
    
    showStep(0);
}

function generateAdmissionNumber() {
    const satsNo = document.getElementById('satsNo').value.trim();
    
    if (!satsNo || !/^[0-9]+$/.test(satsNo)) {
        document.getElementById('admissionNo').value = '';
        return;
    }
    
    // Generate admission number: ADM-YEAR-SATS-RANDOM
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const admissionNo = `ADM${year}${satsNo.slice(-4)}${random}`;
    
    document.getElementById('admissionNo').value = admissionNo;
}



// Duplicate checking function
async function checkForDuplicates(data) {
    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'check_duplicates',
                data: {
                    mobile: data.mobile,
                    satsNo: data.satsNo,
                    aadhaar: data.aadhaar,
                    registerNo: data.registerNo,
                    admissionNo: data.admissionNo
                }
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Duplicate check error:', error);
        // Return false if check fails (allow submission)
        return { isDuplicate: false, message: 'Unable to check duplicates' };
    }
}

// Update mark limits based on board selection
function updateMarkLimits() {
    const board = document.getElementById('board').value;
    const medium = document.getElementById('academicMedium').value;

    // Update 1st language max marks and labels
    const lang1Field = document.getElementById('lang1Marks');
    const lang1Label = document.getElementById('lang1MarksLabel');
    const lang1Error = document.getElementById('lang1Marks-error');

    if (board === 'State Board' || board === 'Other') {
        // State Board: 1st Language always = 125 marks, others = 100 marks
        lang1Field.max = 125;
        if (lang1Label) lang1Label.innerHTML = '1st Language Marks (out of 125) <span class="required">*</span>';
        if (lang1Error) lang1Error.textContent = 'Marks must be between 0-125';
    } else {
        // CBSE/ICSE: All subjects = 100 marks
        lang1Field.max = 100;
        if (lang1Label) lang1Label.innerHTML = '1st Language Marks (out of 100) <span class="required">*</span>';
        if (lang1Error) lang1Error.textContent = 'Marks must be between 0-100';
    }

    // Update total marks hint
    const totalMarksHint = document.querySelector('small[style*="Auto-calculated"]');
    if (totalMarksHint) {
        if (board === 'State Board' || board === 'Other') {
            totalMarksHint.innerHTML = 'Auto-calculated: 125 + 100×5 = 625';
        } else {
            totalMarksHint.innerHTML = 'Auto-calculated: Best 5 of 6 subjects = 500';
        }
    }
}

// Calculate percentage based on board
function calculatePercentage() {
    const board = document.getElementById('board').value;
    const medium = document.getElementById('academicMedium').value;

    if (!board) {
        return; // Don't calculate if no board selected
    }

    const lang1 = parseFloat(document.getElementById('lang1Marks').value) || 0;
    const lang2 = parseFloat(document.getElementById('lang2Marks').value) || 0;
    const lang3 = parseFloat(document.getElementById('lang3Marks').value) || 0;
    const math = parseFloat(document.getElementById('mathMarks').value) || 0;
    const science = parseFloat(document.getElementById('scienceMarks').value) || 0;
    const socialScience = parseFloat(document.getElementById('socialScienceMarks').value) || 0;

    let totalMarks = 0;
    let obtainedMarks = 0;
    let percentage = 0;
    let cbseGrade = '';
    let karnatakaGrade = '';

    if (board === 'State Board' || board === 'Other') {
        // State Board: 1st Language = 125, others = 100, total = 625 (regardless of medium)
        totalMarks = 625;
        obtainedMarks = lang1 + lang2 + lang3 + math + science + socialScience;
        percentage = totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100) : 0;
        karnatakaGrade = calculateKarnatakaSSLCGrade(obtainedMarks);
    } else if (board === 'CBSE' || board === 'ICSE') {
        // CBSE / ICSE Class 10: Best 5 of 6 subjects are counted, total = 500
        const subjects = [lang1, lang2, lang3, math, science, socialScience];
        const bestFive = subjects.sort((a, b) => b - a).slice(0, 5);
        obtainedMarks = bestFive.reduce((sum, mark) => sum + mark, 0);
        totalMarks = 500;

        if (board === 'CBSE') {
            percentage = totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100) : 0;
            cbseGrade = calculateCBSEGrade(percentage);
        } else {
            percentage = totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100) : 0;
        }
    }

    document.getElementById('totalMarks').value = totalMarks;
    document.getElementById('marksObtained').value = obtainedMarks.toFixed(2);
    document.getElementById('percentage').value = percentage.toFixed(2);

    const gradeDisplay = document.getElementById('cbseGradeDisplay');
    const gradeLabel = document.getElementById('cbseGradeLabel');
    const gradeValue = document.getElementById('cbseGrade');
    const gradeDescription = document.getElementById('gradeDescription');

    if (board === 'CBSE' && cbseGrade) {
        gradeDisplay.style.display = 'block';
        if (gradeLabel) gradeLabel.textContent = 'CBSE Grade:';
        gradeValue.textContent = cbseGrade;
        if (gradeDescription) gradeDescription.textContent = '📊 CBSE 9-point grading scale: A-1 (91%+), A-2 (81%+), B-1 (71%+), B-2 (61%+), C-1 (51%+), C-2 (41%+), D-1 (33%+), D-2 (21%+), E (Fail)';
    } else if ((board === 'State Board' || board === 'Other') && karnatakaGrade) {
        gradeDisplay.style.display = 'block';
        if (gradeLabel) gradeLabel.textContent = 'Karnataka SSLC Grade:';
        gradeValue.textContent = karnatakaGrade;
        if (gradeDescription) gradeDescription.textContent = '📊 Karnataka SSLC 2026 grading: A+ (563-625), A (500-562), B+ (438-499), B (375-437), C+ (313-374), C (219-312)';
    } else {
        gradeDisplay.style.display = 'none';
    }
}

// Calculate CBSE grade based on percentage (9-point scale)
function calculateCBSEGrade(percentage) {
    if (percentage >= 91) return 'A-1';
    if (percentage >= 81) return 'A-2';
    if (percentage >= 71) return 'B-1';
    if (percentage >= 61) return 'B-2';
    if (percentage >= 51) return 'C-1';
    if (percentage >= 41) return 'C-2';
    if (percentage >= 33) return 'D-1';
    if (percentage >= 21) return 'D-2';
    return 'E';
}

// Calculate Karnataka SSLC grade based on marks obtained (2026 grading system)
function calculateKarnatakaSSLCGrade(marksObtained) {
    if (marksObtained >= 563 && marksObtained <= 625) return 'A+';
    if (marksObtained >= 500 && marksObtained <= 562) return 'A';
    if (marksObtained >= 438 && marksObtained <= 499) return 'B+';
    if (marksObtained >= 375 && marksObtained <= 437) return 'B';
    if (marksObtained >= 313 && marksObtained <= 374) return 'C+';
    if (marksObtained >= 219 && marksObtained <= 312) return 'C';
    if (marksObtained < 219) return 'Fail';
    return 'Invalid';
}

// Validate CBSE pass criteria
function validateCBSEPassCriteria() {
    const board = document.getElementById('board').value;
    
    if (board !== 'CBSE') {
        return true; // Skip validation for non-CBSE boards
    }
    
    // Get all subject marks
    const subjects = [
        { name: '1st Language', marks: parseFloat(document.getElementById('lang1Marks').value) || 0, max: 125 },
        { name: '2nd Language', marks: parseFloat(document.getElementById('lang2Marks').value) || 0, max: 100 },
        { name: '3rd Language', marks: parseFloat(document.getElementById('lang3Marks').value) || 0, max: 100 },
        { name: 'Mathematics', marks: parseFloat(document.getElementById('mathMarks').value) || 0, max: 100 },
        { name: 'Science', marks: parseFloat(document.getElementById('scienceMarks').value) || 0, max: 100 },
        { name: 'Social Science', marks: parseFloat(document.getElementById('socialScienceMarks').value) || 0, max: 100 }
    ];
    
    let failedSubjects = [];
    
    // Check each subject for 33% pass criteria
    subjects.forEach(subject => {
        const percentage = (subject.marks / subject.max) * 100;
        if (percentage < 33) {
            failedSubjects.push(`${subject.name} (${percentage.toFixed(1)}%)`);
        }
    });
    
    if (failedSubjects.length > 0) {
        alert(`CBSE Pass Criteria Not Met:\n\nThe following subjects have less than 33% marks:\n${failedSubjects.join('\n')}\n\nCBSE requires 33% in each subject to pass.`);
        return false;
    }
    
    return true;
}

// Test function for board calculations (can be called from browser console)
function testBoardCalculations() {
    console.log('Testing Board & Medium-based Percentage Calculations:');
    console.log('====================================================');

    // Test data for different boards and mediums
    const testData = {
        stateBoard: { lang1: 110, lang2: 85, lang3: 90, math: 95, science: 88, socialScience: 92 },
        cbse: { lang1: 95, lang2: 88, lang3: 92, math: 96, science: 89, socialScience: 94 },
        icse: { lang1: 95, lang2: 87, lang3: 91, math: 94, science: 86, socialScience: 90 }
    };

    console.log('State Board Calculations:');
    console.log('-------------------------');

    // Test State Board - Kannada Medium (1st Lang = 125, others = 100, total = 625)
    let total = 625;
    let obtained = Object.values(testData.stateBoard).reduce((a, b) => a + b, 0);
    let percentage = ((obtained / total) * 100).toFixed(2);
    console.log(`State Board (Kannada Medium): ${obtained}/${total} = ${percentage}%`);

    // Test State Board - English Medium (all subjects = 100, total = 600)
    total = 600;
    obtained = Object.values(testData.stateBoard).reduce((a, b) => a + b, 0);
    percentage = ((obtained / total) * 100).toFixed(2);
    console.log(`State Board (English Medium): ${obtained}/${total} = ${percentage}%`);

    console.log('');
    console.log('CBSE/ICSE Calculations (Best 5 of 6 subjects = 500):');
    console.log('---------------------------------------------------');

    // Test CBSE - Best 5 calculation
    const cbseSubjects = Object.values(testData.cbse);
    const cbseBestFive = cbseSubjects.sort((a, b) => b - a).slice(0, 5);
    obtained = cbseBestFive.reduce((sum, mark) => sum + mark, 0);
    total = 500;
    percentage = ((obtained / total) * 100).toFixed(2);
    let grade = calculateCBSEGrade(parseFloat(percentage));
    console.log(`CBSE: Best 5 of [${cbseSubjects.join(', ')}] = ${obtained}/${total} = ${percentage}% (Grade: ${grade})`);

    // Test ICSE - Best 5 calculation
    const icseSubjects = Object.values(testData.icse);
    const icseBestFive = icseSubjects.sort((a, b) => b - a).slice(0, 5);
    obtained = icseBestFive.reduce((sum, mark) => sum + mark, 0);
    percentage = ((obtained / total) * 100).toFixed(2);
    console.log(`ICSE: Best 5 of [${icseSubjects.join(', ')}] = ${obtained}/${total} = ${percentage}%`);

    console.log('');
    console.log('CBSE Grading Scale:');
    console.log('A-1: 91%+, A-2: 81%+, B-1: 71%+, B-2: 61%+, C-1: 51%+, C-2: 41%+, D-1: 33%+, D-2: 21%+, E: Fail');
    console.log('====================================================');
    console.log('Test completed successfully!');
}

// Legacy function for backward compatibility
function calculateCBSEPercentage() {
    calculatePercentage();
}

function setupEventListeners() {
    // Real-time validation
    document.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('blur', function() {
            validateField(this);
        });
        
        field.addEventListener('input', function() {
            clearError(this);
        });
    });
    
    // Progress bar click navigation
    document.querySelectorAll('.progress-step').forEach(step => {
        step.addEventListener('click', function() {
            const stepNum = parseInt(this.dataset.step);
            if (stepNum < currentStep || validateCurrentStep()) {
                currentStep = stepNum;
                showStep(stepNum);
            }
        });
    });

    // Next/back button navigation
    document.querySelectorAll('button[data-action="next"]').forEach(button => {
        button.addEventListener('click', function() {
            nextStep();
        });
    });

    document.querySelectorAll('button[data-action="back"]').forEach(button => {
        button.addEventListener('click', function() {
            prevStep();
        });
    });
}

function showStep(step) {
    // Hide all steps
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    
    // Show current step
    document.querySelectorAll('.step')[step].classList.add('active');
    
    // Update progress bar
    updateProgressBar(step);
    
    // Update buttons
    updateButtons(step);
    
    // Show summary on final step
    if (step === totalSteps - 1) {
        showReviewSummary();
    }
    
    // Scroll to top
    document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    currentStep = step;
}

function updateProgressBar(step) {
    document.querySelectorAll('.progress-step').forEach((s, idx) => {
        s.classList.remove('active', 'completed');
        if (idx < step) {
            s.classList.add('completed');
        } else if (idx === step) {
            s.classList.add('active');
        }
    });
}

function updateButtons(step) {
    const activeStep = document.querySelectorAll('.step')[step];
    const backBtn = activeStep ? activeStep.querySelector('.btn-secondary') : null;
    const nextBtn = activeStep ? activeStep.querySelector('.btn-primary') : null;

    if (!backBtn || !nextBtn) {
        return;
    }
    
    if (step === 0) {
        backBtn.disabled = true;
    } else {
        backBtn.disabled = false;
    }
    
    if (step === totalSteps - 1) {
        nextBtn.textContent = 'Generate Final PDF';
        nextBtn.type = 'submit';
    } else {
        nextBtn.textContent = 'Next →';
        nextBtn.type = 'button';
    }
}

function validateField(field) {
    if (field.disabled) {
        return true;
    }

    const value = typeof field.value === 'string' ? field.value.trim() : '';
    const fieldId = field.id;
    const errorElement = document.getElementById(fieldId + '-error');
    
    let isValid = true;
    
    // Required field check
    if (field.hasAttribute('required')) {
        const hasValue = field.type === 'checkbox' ? field.checked : !!value;
        if (!hasValue) {
            isValid = false;
            if (errorElement) {
                errorElement.textContent = 'This field is required';
            }
        }
    }
    
    // Pattern validation
    if (isValid && field.hasAttribute('pattern') && value) {
        const pattern = new RegExp(field.getAttribute('pattern'));
        if (!pattern.test(value)) {
            isValid = false;
            if (errorElement) {
                errorElement.textContent = field.title || 'Invalid format';
            }
        }
    }
    
    // Email validation
    if (isValid && field.type === 'email' && value) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) {
            isValid = false;
            if (errorElement) {
                errorElement.textContent = 'Invalid email address';
            }
        }
    }
    
    // Mobile validation
    if (isValid && fieldId === 'mobile' && value && value.length !== 10) {
        isValid = false;
        if (errorElement) {
            errorElement.textContent = 'Mobile must be 10 digits';
        }
    }
    
    if (!isValid) {
        field.classList.add('invalid');
        if (errorElement) {
            errorElement.style.display = 'block';
        }
    } else {
        field.classList.remove('invalid');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }
    
    return isValid;
}

function clearError(field) {
    const errorElement = document.getElementById(field.id + '-error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
    field.classList.remove('invalid');
}

function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + '-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else {
        alert(message);
    }
    if (field) {
        field.classList.add('invalid');
    }
}

function validateCurrentStep() {
    const step = document.querySelectorAll('.step')[currentStep];
    const fields = step.querySelectorAll('input[required], select[required], textarea[required]');
    
    let allValid = true;
    let missingFields = [];
    
    fields.forEach(field => {
        if (!validateField(field)) {
            allValid = false;
            const group = field.closest('.form-group');
            const label = group ? group.querySelector('label') : null;
            const fieldName = label ? label.textContent.replace(/\s*\*/g, '').trim() : field.id;
            missingFields.push(fieldName);
        }
    });
    
    if (!allValid && missingFields.length > 0) {
        alert('Please fill all required fields:\n\n' + missingFields.join('\n'));
    }
    
    return allValid;
}

function nextStep() {
    // Allow proceeding from first step without full validation for demo purposes
    if (currentStep === 0 || validateCurrentStep()) {
        if (currentStep < totalSteps - 1) {
            showStep(currentStep + 1);
        }
    }
}

function prevStep() {
    if (currentStep > 0) {
        showStep(currentStep - 1);
    }
}

function getFieldValue(fieldId) {
    const field = document.getElementById(fieldId);
    return field ? field.value : '';
}

function collectFormData() {
    formData = {
        // Step 0
        admissionNo: getFieldValue('admissionNo'),
        satsNo: getFieldValue('satsNo'),
        stream: getFieldValue('stream'),
        medium: getFieldValue('medium'),
        section: getFieldValue('section'),
        reservation: getFieldValue('reservation'),
        
        // Step 1
        studentName: getFieldValue('studentName'),
        dob: getFieldValue('dob'),
        gender: getFieldValue('gender'),
        placeOfBirth: getFieldValue('placeOfBirth'),
        state: getFieldValue('state'),
        district: getFieldValue('district'),
        taluk: getFieldValue('taluk'),
        nationality: getFieldValue('nationality'),
        religion: getFieldValue('religion'),
        caste: getFieldValue('caste'),
        subcaste: getFieldValue('subcaste'),
        
        // Step 2
        permanentAddress: getFieldValue('permanentAddress'),
        localAddress: getFieldValue('localAddress'),
        mobile: getFieldValue('mobile'),
        email: getFieldValue('email'),
        aadhaar: getFieldValue('aadhaar'),
        
        // Step 3
        fatherName: getFieldValue('fatherName'),
        motherName: getFieldValue('motherName'),
        parentAddress: getFieldValue('parentAddress'),
        income: getFieldValue('income'),
        incomeCertificate: getFieldValue('incomeCertificate'),
        
        // Step 4
        schoolName: getFieldValue('schoolName'),
        registerNo: getFieldValue('registerNo'),
        passingMonth: getFieldValue('passingMonth'),
        board: getFieldValue('board'),
        academicMedium: getFieldValue('academicMedium'),
        totalMarks: getFieldValue('totalMarks'),
        marksObtained: getFieldValue('marksObtained'),
        percentage: getFieldValue('percentage'),
        grade: document.getElementById('cbseGrade')?.textContent || '',
        result: getFieldValue('result'),
        
        // SSLC Subject Marks
        lang1Name: getFieldValue('lang1Name'),
        lang1Marks: getFieldValue('lang1Marks'),
        lang2Name: getFieldValue('lang2Name'),
        lang2Marks: getFieldValue('lang2Marks'),
        lang3Name: getFieldValue('lang3Name'),
        lang3Marks: getFieldValue('lang3Marks'),
        mathMarks: getFieldValue('mathMarks'),
        scienceMarks: getFieldValue('scienceMarks'),
        socialScienceMarks: getFieldValue('socialScienceMarks'),
        
        // Step 5
        firstLanguage: getFieldValue('firstLanguage'),
        courses: getSelectedCheckboxes('courses'),
        activities: getSelectedCheckboxes('activities'),
        languageExemption: getFieldValue('languageExemption'),
        physicallyChallenged: getFieldValue('physicallyChallenged'),
        
        // Timestamp
        submittedAt: new Date().toLocaleString()
    };
    
    return formData;
}

function getSelectedCheckboxes(name) {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value).join(', ');
}

function showReviewSummary() {
    try {
        collectFormData();
        const uploadedDocuments = getUploadedDocuments();

        const summary = `
        <h4 style="color: #333; margin-bottom: 15px;">Application Summary</h4>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
            <tr style="background: #f0f0f0;"><td style="padding: 10px; border: 1px solid #ddd;"><b>Admission Number</b></td><td style="padding: 10px; border: 1px solid #ddd;">${formData.admissionNo || 'N/A'}</td></tr>
            <tr><td style="padding: 10px; border: 1px solid #ddd;"><b>SATS Number</b></td><td style="padding: 10px; border: 1px solid #ddd;">${formData.satsNo || 'N/A'}</td></tr>
            <tr style="background: #f0f0f0;"><td style="padding: 10px; border: 1px solid #ddd;"><b>Student Name</b></td><td style="padding: 10px; border: 1px solid #ddd;">${formData.studentName || 'N/A'}</td></tr>
            <tr><td style="padding: 10px; border: 1px solid #ddd;"><b>Stream</b></td><td style="padding: 10px; border: 1px solid #ddd;">${formData.stream || 'N/A'}</td></tr>
            <tr style="background: #f0f0f0;"><td style="padding: 10px; border: 1px solid #ddd;"><b>Medium</b></td><td style="padding: 10px; border: 1px solid #ddd;">${formData.medium || 'N/A'}</td></tr>
            <tr><td style="padding: 10px; border: 1px solid #ddd;"><b>Section</b></td><td style="padding: 10px; border: 1px solid #ddd;">${formData.section || 'N/A'}</td></tr>
            <tr style="background: #f0f0f0;"><td style="padding: 10px; border: 1px solid #ddd;"><b>Date of Birth</b></td><td style="padding: 10px; border: 1px solid #ddd;">${formData.dob || 'N/A'}</td></tr>
            <tr><td style="padding: 10px; border: 1px solid #ddd;"><b>Mobile</b></td><td style="padding: 10px; border: 1px solid #ddd;">${formData.mobile || 'N/A'}</td></tr>
            <tr style="background: #f0f0f0;"><td style="padding: 10px; border: 1px solid #ddd;"><b>Email</b></td><td style="padding: 10px; border: 1px solid #ddd;">${formData.email || 'N/A'}</td></tr>
            <tr><td style="padding: 10px; border: 1px solid #ddd;"><b>Percentage</b></td><td style="padding: 10px; border: 1px solid #ddd;">${formData.percentage || '0'}%</td></tr>
            <tr style="background: #f0f0f0;"><td style="padding: 10px; border: 1px solid #ddd;"><b>Courses</b></td><td style="padding: 10px; border: 1px solid #ddd;">${formData.courses || 'N/A'}</td></tr>
        </table>

        <h4 style="color: #333; margin: 20px 0 12px;">Uploaded Documents</h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
            ${uploadedDocuments.map((doc, index) => `
                <tr style="background: ${index % 2 === 0 ? '#f0f0f0' : '#ffffff'};">
                    <td style="padding: 10px; border: 1px solid #ddd;"><b>${doc.label}</b></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${doc.status}</td>
                </tr>
            `).join('')}
        </table>

        <div style="background: #eef7ff; border-left: 4px solid #2e6da4; padding: 14px; border-radius: 6px; margin-bottom: 16px;">
            <h4 style="margin-bottom: 8px; color: #1f4e79;">Declaration To College</h4>
            <p style="margin: 0; line-height: 1.6; color: #2f3e46;">I confirm that all information provided in this application is true and complete to the best of my knowledge. I understand that the college may verify the details and documents submitted by me, and any incorrect information may affect admission eligibility.</p>
        </div>

        <div style="background: #f8f9fa; border: 1px solid #d7dee3; padding: 14px; border-radius: 6px; color: #495057; line-height: 1.6;">
            <b>Instruction:</b> Click <b>Generate Final PDF</b> to download your complete application summary as a PDF file for submission to the college.
        </div>
    `;
        
        const reviewElement = document.getElementById('reviewSummary');
        if (reviewElement) {
            reviewElement.innerHTML = summary;
        }
    } catch (error) {
        console.error('Error generating summary:', error);
        const reviewElement = document.getElementById('reviewSummary');
        if (reviewElement) {
            reviewElement.innerHTML = '<p style="color: red;">Error loading summary. Please scroll up to verify your information.</p>';
        }
    }
}

async function submitForm(e) {
    e.preventDefault();
    
    // Final validation
    if (!validateCurrentStep()) {
        alert('Please fill all required fields');
        return;
    }
    
    // Check required file uploads
    const studentPhoto = document.getElementById('studentPhoto').files.length;
    const marksheet = document.getElementById('marksheet').files.length;
    const transferCertificate = document.getElementById('transferCertificate').files.length;
    
    if (!studentPhoto || !marksheet || !transferCertificate) {
        alert('Please upload: Student Photo, Marksheet, and Transfer Certificate');
        return;
    }
    
    // Check terms agreement
    if (!document.getElementById('termsAgree').checked) {
        alert('Please accept the declaration');
        return;
    }
    
    collectFormData();
    
    // Validate CBSE pass criteria if applicable
    if (!validateCBSEPassCriteria()) {
        return; // Stop submission if CBSE criteria not met
    }
    
    // Check for duplicates before submission
    try {
        const duplicateCheck = await checkForDuplicates(formData);
        if (duplicateCheck.isDuplicate) {
            alert(`Duplicate registration detected: ${duplicateCheck.message}\n\nPlease check your information and try again.`);
            return;
        }
    } catch (error) {
        console.error('Duplicate check failed:', error);
        // Continue with submission if duplicate check fails
    }
    
    // Show loading
    document.getElementById('loading').style.display = 'block';
    document.getElementById('admissionForm').style.display = 'none';
    
    try {
        await generateSubmissionPDF(formData);
        showSuccessMessage(formData.admissionNo);
    } catch (error) {
        console.error('Submission error:', error);
        showErrorMessage('Connection error: ' + error.message);
    }
}

function showSuccessMessage(admissionNo) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('admissionResult').textContent = admissionNo;
    document.getElementById('successMessage').classList.add('show');
    
    // Save to localStorage as backup
    localStorage.setItem('lastAdmissionNo', admissionNo);
    localStorage.setItem('formData', JSON.stringify(formData));
}

function showErrorMessage(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('admissionForm').style.display = 'block';
    alert(message);
}

function getUploadedDocuments() {
    return [
        { label: 'Aadhaar Document', file: document.getElementById('aadhaarDocument')?.files?.[0] || null },
        { label: 'Student Photo', file: document.getElementById('studentPhoto')?.files?.[0] || null },
        { label: 'Marksheet', file: document.getElementById('marksheet')?.files?.[0] || null },
        { label: 'Transfer Certificate', file: document.getElementById('transferCertificate')?.files?.[0] || null }
    ].map(doc => ({
        label: doc.label,
        file: doc.file,
        status: doc.file ? `${doc.file.name} (${Math.max(1, Math.round(doc.file.size / 1024))} KB)` : 'Not uploaded'
    }));
}

function addPdfSection(doc, title, entries, yPosition) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const lineHeight = 7;
    let y = yPosition;

    if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    entries.forEach(entry => {
        const value = entry.value || 'N/A';
        const lines = doc.splitTextToSize(`${entry.label}: ${value}`, pageWidth - (margin * 2));
        if (y + (lines.length * lineHeight) > pageHeight - 20) {
            doc.addPage();
            y = 20;
        }
        doc.text(lines, margin, y);
        y += lines.length * lineHeight;
    });

    return y + 4;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read file for PDF generation'));
        reader.readAsDataURL(file);
    });
}

async function addStudentPhotoToPdf(pdf, x, y, width, height) {
    const photoFile = document.getElementById('studentPhoto')?.files?.[0];

    if (!photoFile || !photoFile.type.startsWith('image/')) {
        return;
    }

    const imageDataUrl = await readFileAsDataUrl(photoFile);
    const imageProps = pdf.getImageProperties(imageDataUrl);
    const ratio = Math.min(width / imageProps.width, height / imageProps.height);
    const renderWidth = imageProps.width * ratio;
    const renderHeight = imageProps.height * ratio;
    const imgX = x + ((width - renderWidth) / 2);
    const imgY = y + ((height - renderHeight) / 2);

    pdf.setDrawColor(180, 180, 180);
    pdf.rect(x, y, width, height);
    pdf.addImage(imageDataUrl, photoFile.type === 'image/png' ? 'PNG' : 'JPEG', imgX, imgY, renderWidth, renderHeight);
}

async function addAadhaarToPdf(pdf, yPosition) {
    const aadhaarFile = document.getElementById('aadhaarDocument')?.files?.[0];

    if (!aadhaarFile || (!aadhaarFile.type.startsWith('image/') && aadhaarFile.type !== 'application/pdf')) {
        return yPosition;
    }

    // Add section title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Aadhaar Document', 15, yPosition);
    yPosition += 8;

    if (aadhaarFile.type === 'application/pdf') {
        // For PDF files, just show filename
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.text(`PDF Document: ${aadhaarFile.name}`, 20, yPosition);
        yPosition += 10;
    } else {
        // For image files, embed the image
        try {
            const imageDataUrl = await readFileAsDataUrl(aadhaarFile);
            const imageProps = pdf.getImageProperties(imageDataUrl);
            const maxWidth = 80;
            const maxHeight = 60;
            const ratio = Math.min(maxWidth / imageProps.width, maxHeight / imageProps.height);
            const renderWidth = imageProps.width * ratio;
            const renderHeight = imageProps.height * ratio;
            const x = 15 + ((maxWidth - renderWidth) / 2);
            const y = yPosition;

            pdf.setDrawColor(180, 180, 180);
            pdf.rect(15, yPosition, maxWidth, maxHeight);
            pdf.addImage(imageDataUrl, aadhaarFile.type === 'image/png' ? 'PNG' : 'JPEG', x, y, renderWidth, renderHeight);
            yPosition += maxHeight + 5;
        } catch (error) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.text(`Error loading image: ${aadhaarFile.name}`, 20, yPosition);
            yPosition += 10;
        }
    }

    return yPosition;
}

async function addMarksheetToPdf(pdf, yPosition) {
    const marksheetFile = document.getElementById('marksheet')?.files?.[0];

    if (!marksheetFile || (!marksheetFile.type.startsWith('image/') && marksheetFile.type !== 'application/pdf')) {
        return yPosition;
    }

    // Add section title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Marksheet Document', 15, yPosition);
    yPosition += 8;

    if (marksheetFile.type === 'application/pdf') {
        // For PDF files, just show filename
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.text(`PDF Document: ${marksheetFile.name}`, 20, yPosition);
        yPosition += 10;
    } else {
        // For image files, embed the image
        try {
            const imageDataUrl = await readFileAsDataUrl(marksheetFile);
            const imageProps = pdf.getImageProperties(imageDataUrl);
            const maxWidth = 80;
            const maxHeight = 60;
            const ratio = Math.min(maxWidth / imageProps.width, maxHeight / imageProps.height);
            const renderWidth = imageProps.width * ratio;
            const renderHeight = imageProps.height * ratio;
            const x = 15 + ((maxWidth - renderWidth) / 2);
            const y = yPosition;

            pdf.setDrawColor(180, 180, 180);
            pdf.rect(15, yPosition, maxWidth, maxHeight);
            pdf.addImage(imageDataUrl, marksheetFile.type === 'image/png' ? 'PNG' : 'JPEG', x, y, renderWidth, renderHeight);
            yPosition += maxHeight + 5;
        } catch (error) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.text(`Error loading image: ${marksheetFile.name}`, 20, yPosition);
            yPosition += 10;
        }
    }

    return yPosition;
}

async function addTransferCertificateToPdf(pdf, yPosition) {
    const tcFile = document.getElementById('transferCertificate')?.files?.[0];

    if (!tcFile || (!tcFile.type.startsWith('image/') && tcFile.type !== 'application/pdf')) {
        return yPosition;
    }

    // Add section title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Transfer Certificate', 15, yPosition);
    yPosition += 8;

    if (tcFile.type === 'application/pdf') {
        // For PDF files, just show filename
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.text(`PDF Document: ${tcFile.name}`, 20, yPosition);
        yPosition += 10;
    } else {
        // For image files, embed the image
        try {
            const imageDataUrl = await readFileAsDataUrl(tcFile);
            const imageProps = pdf.getImageProperties(imageDataUrl);
            const maxWidth = 80;
            const maxHeight = 60;
            const ratio = Math.min(maxWidth / imageProps.width, maxHeight / imageProps.height);
            const renderWidth = imageProps.width * ratio;
            const renderHeight = imageProps.height * ratio;
            const x = 15 + ((maxWidth - renderWidth) / 2);
            const y = yPosition;

            pdf.setDrawColor(180, 180, 180);
            pdf.rect(15, yPosition, maxWidth, maxHeight);
            pdf.addImage(imageDataUrl, tcFile.type === 'image/png' ? 'PNG' : 'JPEG', x, y, renderWidth, renderHeight);
            yPosition += maxHeight + 5;
        } catch (error) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.text(`Error loading image: ${tcFile.name}`, 20, yPosition);
            yPosition += 10;
        }
    }

    return yPosition;
}

async function generateSubmissionPDF(data) {
    const jsPDF = window.jspdf?.jsPDF || window.jspPDF?.jsPDF;
    if (!jsPDF) {
        throw new Error('jsPDF library not loaded. Please check the script include in application_form.html.');
    }
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let y = 25;

    // ===== HEADER =====
    pdf.setFillColor(40, 85, 165);
    pdf.rect(0, 0, pageWidth, 24, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('SRI VIDYALAYA PU COLLEGE', pageWidth / 2, 10, { align: 'center' });

    pdf.setFontSize(10);
    pdf.text('ADMISSION APPLICATION FORM', pageWidth / 2, 17, { align: 'center' });

    pdf.setTextColor(0, 0, 0);

    // ===== PHOTO =====
    const photoX = pageWidth - margin - 42;
    const photoY = 26;
    pdf.setDrawColor(180);
    pdf.rect(photoX, photoY, 42, 52);
    await addStudentPhotoToPdf(pdf, photoX, photoY, 42, 52);

    // ===== HELPERS =====
    function addPage() {
        pdf.addPage();
        y = margin + 5;
    }

    function newPageIfNeeded(requiredHeight = 12) {
        if (y + requiredHeight > pageHeight - margin) {
            addPage();
        }
    }

    function section(title) {
        newPageIfNeeded(14);
        pdf.setFillColor(235, 242, 255);
        pdf.setDrawColor(144, 171, 220);
        pdf.rect(margin, y - 6, pageWidth - margin * 2, 10, 'F');
        pdf.rect(margin, y - 6, pageWidth - margin * 2, 10);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(24, 56, 112);
        pdf.text(title, margin + 2, y);
        y += 12;
    }

    function field(label, value) {
        const text = pdf.splitTextToSize(value || 'N/A', pageWidth - margin * 2 - 55);
        newPageIfNeeded(text.length * 6 + 8);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(label + ':', margin, y);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.text(text, margin + 55, y);
        y += text.length * 6 + 6;
    }

    function fieldPair(label1, value1, label2, value2) {
        const colWidth = (pageWidth - margin * 2 - 10) / 2;
        const text1 = pdf.splitTextToSize(value1 || 'N/A', colWidth - 25);
        const text2 = pdf.splitTextToSize(value2 || 'N/A', colWidth - 25);
        const rowHeight = Math.max(text1.length, text2.length) * 6 + 10;
        newPageIfNeeded(rowHeight);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text(label1 + ':', margin, y);
        pdf.text(label2 + ':', margin + colWidth + 10, y);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.text(text1, margin, y + 6);
        pdf.text(text2, margin + colWidth + 10, y + 6);
        y += rowHeight;
    }

    function divider() {
        newPageIfNeeded(8);
        pdf.setDrawColor(200);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 10;
    }

    // ===== BASIC =====
    section('Basic Information');
    fieldPair('Admission No', data.admissionNo, 'SATS No', data.satsNo);
    fieldPair('Stream', data.stream, 'Medium', data.medium);
    fieldPair('Section', data.section, 'Reservation', data.reservation);

    section('Personal Details');
    field('Student Name', data.studentName);
    fieldPair('DOB', data.dob, 'Gender', data.gender);
    field('Place of Birth', data.placeOfBirth);
    fieldPair('State', data.state, 'District', data.district);
    fieldPair('Taluk', data.taluk, 'Nationality', data.nationality);
    fieldPair('Religion', data.religion, 'Caste', data.caste);
    field('Subcaste', data.subcaste);

    section('Contact Details');
    field('Permanent Address', data.permanentAddress);
    field('Local Address', data.localAddress);
    fieldPair('Mobile', data.mobile, 'Email', data.email);
    field('Aadhaar', data.aadhaar);

    section('Academic Details');
    field('School Name', data.schoolName);
    fieldPair('Register No', data.registerNo, 'Board', data.board);
    fieldPair('Marks Obtained', data.marksObtained || '-', 'Total Marks', data.totalMarks || '-');
    fieldPair('Percentage', data.percentage ? `${data.percentage}%` : '-', 'Grade', data.grade || '-');

    newPageIfNeeded(28);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Subject Marks', margin, y);
    y += 7;
    pdf.setDrawColor(180);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;

    const tableX = margin;
    const tableWidth = pageWidth - margin * 2;
    const subjectRows = [
        ['Subject', 'Marks Obtained'],
        [data.lang1Name || '1st Language', data.lang1Marks || '-'],
        [data.lang2Name || '2nd Language', data.lang2Marks || '-'],
        [data.lang3Name || '3rd Language', data.lang3Marks || '-'],
        ['Mathematics', data.mathMarks || '-'],
        ['Science', data.scienceMarks || '-'],
        ['Social Science', data.socialScienceMarks || '-']
    ];

    subjectRows.forEach((row, index) => {
        newPageIfNeeded(10);
        if (index === 0) {
            pdf.setFillColor(235, 242, 255);
            pdf.rect(tableX, y - 4, tableWidth, 8, 'F');
            pdf.setFont('helvetica', 'bold');
        } else {
            pdf.setFont('helvetica', 'normal');
        }
        pdf.setTextColor(0, 0, 0);
        pdf.text(row[0], tableX + 2, y);
        pdf.text(String(row[1]), tableX + tableWidth - 4, y, { align: 'right' });
        y += 8;
    });

    y += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Total Obtained: ${data.marksObtained || '0'} / ${data.totalMarks || '0'}`, margin, y);
    y += 7;
    pdf.text(`Percentage: ${data.percentage || '0'}%`, margin, y);

    addPage();
    section('Uploaded Documents Preview');

    const files = [
        { id: 'studentPhoto', label: 'Student Photo' },
        { id: 'aadhaarDocument', label: 'Aadhaar Document' },
        { id: 'marksheet', label: 'Marksheet' },
        { id: 'transferCertificate', label: 'Transfer Certificate' }
    ];

    for (let fileObj of files) {
        const file = document.getElementById(fileObj.id)?.files?.[0];
        newPageIfNeeded(110);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text(fileObj.label, margin, y);
        y += 7;

        const boxHeight = 90;
        pdf.setDrawColor(180);
        pdf.rect(margin, y, pageWidth - margin * 2, boxHeight);

        if (file && file.type.startsWith('image/')) {
            const imgData = await readFileAsDataUrl(file);
            const imgProps = pdf.getImageProperties(imgData);
            const maxWidth = pageWidth - margin * 2 - 10;
            const maxHeight = boxHeight - 10;
            const ratio = Math.min(maxWidth / imgProps.width, maxHeight / imgProps.height);
            const width = imgProps.width * ratio;
            const height = imgProps.height * ratio;
            const x = margin + ((pageWidth - margin * 2) - width) / 2;
            const imgY = y + ((boxHeight - height) / 2);
            pdf.addImage(imgData, file.type.includes('png') ? 'PNG' : 'JPEG', x, imgY, width, height);
        } else if (file) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.text(`Uploaded: ${file.name}`, margin + 5, y + 12);
        } else {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.text('No document uploaded', margin + 5, y + 12);
        }

        y += 102;
    }

    addPage();
    section('Declaration');
    const declarationText = pdf.splitTextToSize(
        'I declare that all the details provided above are true and correct to the best of my knowledge. I understand that the college may verify any information or document submitted and may cancel admission if any information is found false.',
        pageWidth - margin * 2
    );
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(declarationText, margin, y);
    y += declarationText.length * 6 + 15;

    newPageIfNeeded(28);
    pdf.setDrawColor(120);
    pdf.line(margin, y, margin + 60, y);
    pdf.text('Student Signature', margin, y + 6);
    pdf.line(pageWidth - margin - 60, y, pageWidth - margin, y);
    pdf.text('Principal Signature', pageWidth - margin - 60, y + 6);

    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setDrawColor(47, 94, 165);
        pdf.line(margin, 28, pageWidth - margin, 28);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(47, 94, 165);
        pdf.text('Sri Vidyalaya PU College - Admission Form', margin, 14);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(110);
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    pdf.save(`${(data.studentName || 'application').replace(/\s+/g, '_')}_${data.admissionNo || 'form'}.pdf`);
}

window.nextStep = nextStep;
window.prevStep = prevStep;
window.showStep = showStep;
window.submitForm = submitForm;
