const fs = require('fs');

const data = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));

const addIndex = (collectionGroup, field1, order1, field2, order2) => {
    // Check if it exists
    const exists = data.indexes.find(idx => 
        idx.collectionGroup === collectionGroup &&
        idx.fields.length === 2 &&
        idx.fields[0].fieldPath === field1 && idx.fields[0].order === order1 &&
        idx.fields[1].fieldPath === field2 && idx.fields[1].order === order2
    );
    if (!exists) {
        data.indexes.push({
            collectionGroup,
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: field1, order: order1 },
                { fieldPath: field2, order: order2 }
            ]
        });
    }
};

// accountant_ledger (transaction_date DESC)
['type', 'period', 'project_id', 'category', 'entity_type'].forEach(field => {
    addIndex('accountant_ledger', field, 'ASCENDING', 'transaction_date', 'DESCENDING');
});

// bank_transactions (created_at ASC)
['entity_type', 'is_active'].forEach(field => {
    addIndex('bank_transactions', field, 'ASCENDING', 'created_at', 'ASCENDING');
});

// bank_transactions (txn_date DESC)
['account_id', 'entity_type', 'type'].forEach(field => {
    addIndex('bank_transactions', field, 'ASCENDING', 'txn_date', 'DESCENDING');
});

// loan_records (created_at DESC)
['entity_type', 'status', 'category'].forEach(field => {
    addIndex('loan_records', field, 'ASCENDING', 'created_at', 'DESCENDING');
});

// insurance_policies (created_at DESC)
['entity_type', 'status', 'category', 'project_id'].forEach(field => {
    addIndex('insurance_policies', field, 'ASCENDING', 'created_at', 'DESCENDING');
});

fs.writeFileSync('firestore.indexes.json', JSON.stringify(data, null, 4));
console.log('Indexes updated successfully.');
