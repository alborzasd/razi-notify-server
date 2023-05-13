// utility functions for models and schemas

// remove properties from document object
// i.e remove password from user object before send to response
function removeProperties(doc, ...deletingProps){
    if(!doc) return null;
    // document returned from db has '$__', '$isNew' and '_doc' props
    // the actual data is in '_doc' property
    // doc = doc._doc;
    // we need actual data plus the virtual properties
    doc = doc.toObject(); // same as doc.toJSON()
    const result = {};
    for(let prop in doc){
        if(!deletingProps.includes(prop)){
            result[prop] = doc[prop];
        }
    }
    return result;
}

module.exports = {
    removeProperties
}