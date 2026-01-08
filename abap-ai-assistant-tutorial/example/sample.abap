*&---------------------------------------------------------------------*
*& Sample ABAP Code for Testing the AI Assistant Plugin
*&---------------------------------------------------------------------*
*& This file demonstrates various ABAP patterns that the plugin can analyze
*&---------------------------------------------------------------------*

REPORT z_sample_program.

" Variable declarations with different naming conventions
DATA: lv_customer_name TYPE string,
      lv_customer_id TYPE i,
      lv_amount TYPE p DECIMALS 2,
      lt_customers TYPE TABLE OF kna1,
      ls_customer TYPE kna1.

" Another section with consistent naming
DATA: lv_total_count TYPE i,
      lv_processed TYPE i,
      lv_failed TYPE i.

" This variable doesn't follow the convention
DATA: myVariable TYPE string.

START-OF-SELECTION.

  " Example 1: Loop with work area (could be optimized)
  LOOP AT lt_customers INTO ls_customer.
    WRITE: / ls_customer-kunnr, ls_customer-name1.
  ENDLOOP.

  " Example 2: Old-style method call
  CALL METHOD cl_demo_output=>display(
    EXPORTING
      data = 'Hello World'
  ).

  " Example 3: Checking for empty string
  IF lv_customer_name = ''.
    WRITE: / 'Customer name is empty'.
  ENDIF.

  " Example 4: Better pattern - checking IS INITIAL
  IF lv_customer_id IS INITIAL.
    WRITE: / 'Customer ID not set'.
  ENDIF.

  " Example 5: Modern method call syntax
  cl_demo_output=>display( 'Modern syntax' ).

  " Example 6: Loop with field symbol (better performance)
  FIELD-SYMBOLS: <ls_customer> TYPE kna1.
  
  LOOP AT lt_customers ASSIGNING <ls_customer>.
    WRITE: / <ls_customer>-kunnr, <ls_customer>-name1.
  ENDLOOP.

  " Example 7: Conditional checks
  IF lv_amount IS NOT INITIAL.
    lv_total_count = lv_total_count + 1.
  ENDIF.

END-OF-SELECTION.

