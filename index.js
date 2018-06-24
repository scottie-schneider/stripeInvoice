require('dotenv').config();

const stripe = require("stripe")(
  process.env.TWILIOSK
);

const moment = require('moment');
moment().format();

// object that holds the invoices in the format { 'date' : '$200'}, such as { '20' : 200 }
let invoiceObj = {};
let customerList = [];
let totalInvoiceThisMonth = 0;
let totalInvoiceNextMonth = 0;
let totalOpenInvoices = 0;
let countUpcoming = 0;
let countOpen = 0;
let check = 0;

//////////////////////////////////////////////
// Get those customers!
//////////////////////////////////////////////

stripe.customers.list({ limit: 100 })
.then(function(customers){
  for(let i = 0; i < customers.data.length; i++){
    customerList.push(customers.data[i].id);
  }

  //////////////////////////////////////////////
  // Get any open invoices left for the month
  //////////////////////////////////////////////

  stripe.invoices.list(
    {
      limit: 100,
      due_date: {
        'gt': moment.utc().month(), // due date is after this current month's timestamp
        // NOTE: You'll still want to check if there are any super old invoices you're not catching...
        // TODO: Ensure we're paginating
      }
    },
    function(err, invoices) {
      for(let i = 0; i < invoices.data.length; i++){
        if(!invoices.data[i].paid && !invoices.data[i].closed){
          totalOpenInvoices += invoices.data[i].amount_due/100;
          countOpen++;
          console.log(`There is an open invoice due for ${invoices.data[i].amount_due/100}, from customer ${invoices.data[i].customer}`)
        }else{
          countOpen++;
        }
        if(countOpen > invoices.data.length -1){
          done();
        }
      }
    }
  );

  //////////////////////////////////////////////
  // Getting upcoming invoices (not charged yet)
  //////////////////////////////////////////////

  // for each, run the function with a callback
  const asyncForEach = (array, callback) => {
    for(let index = 0; index < array.length; index++){
      callback(array[index])
    }
  }

  const getUpcomingInvoices = async () => {
    await asyncForEach(customerList, async(num) => {
      stripe.invoices.retrieveUpcoming(
        num,
        function(err, upcoming) {
          if(upcoming){ // if the invoice is not null
            let date = moment.unix(upcoming.date);
            let day = moment.unix(upcoming.date).format("DD");
            if (moment(date).isSame(new Date(), 'month')){ // invoice is for this month
              if(day in invoiceObj){ // if invoice exists and day is in the object
                console.log(`UPCOMING ${upcoming.amount_due/100}, paid on the ${day}, by customerID: ${num}`);
                totalInvoiceThisMonth += upcoming.amount_due;
                invoiceObj[day] += upcoming.amount_due/100;
                countUpcoming++;
              }else{ // if invoice exists and day isn't in the object yet
                totalInvoiceThisMonth += upcoming.amount_due;
                invoiceObj[day] = upcoming.amount_due/100;
                console.log(`UPCOMING ${upcoming.amount_due/100}, paid on the ${day}, by customerID: ${num}`);
                countUpcoming++
              }
            } else { // invoice is for next month
              countUpcoming++;
            }
            if(countUpcoming > customerList.length - 1){
              done();
            }
          }else {
            countUpcoming++
            if(countUpcoming > customerList.length - 1){
              done();
            }
          }
        }
      )
    })
  }
  getUpcomingInvoices();

  function done() {
    check++;
    if(check == 2){
      console.log(`Current upcoming invoice total: $${totalInvoiceThisMonth/100}`)
      console.log(`Current oustanding invoices (LATE): $${totalOpenInvoices}`)
      console.log(`Total reclaimable income til end of month: $${totalOpenInvoices+totalInvoiceThisMonth/100}`)
      console.log(invoiceObj);
    }
  }
})
